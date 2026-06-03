import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IngestionJobStatus, MarketDocumentType, Prisma } from "@prisma/client";

import { IngestionJobType } from "../../common/market.enums";
import { PrismaService } from "../../database/prisma.service";
import { CreateIngestionJobDto } from "./dto/create-ingestion-job.dto";

type JsonRecord = Record<string, unknown>;

type StockSeed = {
  symbol: string;
  name: string;
  market: string;
  sector?: string;
  stooqSymbol?: string;
  dartCorpCode?: string;
  newsQuery?: string;
};

type DateWindow = {
  from: string;
  to: string;
  fromDate: Date;
  toDate: Date;
};

type PriceRow = {
  tradeDate: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  closePrice: string;
  volume: bigint;
  source: string;
};

type DocumentRow = {
  documentType: MarketDocumentType;
  title: string;
  body: string;
  source: string;
  sourceUrl: string;
  publishedAt: Date;
  contentHash: string;
};

type IngestionSummary = {
  stocksUpserted: number;
  pricesUpserted: number;
  documentsUpserted: number;
  sourceErrors: string[];
};

type DartListResponse = {
  status?: string;
  message?: string;
  page_no?: number;
  total_page?: number;
  list?: DartDisclosure[];
};

type DartDisclosure = {
  corp_code?: string;
  corp_name?: string;
  stock_code?: string;
  report_nm?: string;
  rcept_no?: string;
  flr_nm?: string;
  rcept_dt?: string;
  rm?: string;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 12_000;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_DATE_WINDOW_DAYS = 7;
const DEFAULT_DOCUMENT_LIMIT = 20;
const DEFAULT_DART_MAX_PAGES = 5;
const STOOQ_SOURCE = "stooq";
const GOOGLE_NEWS_SOURCE = "google_news_rss";
const OPENDART_SOURCE = "opendart";

@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async createJob(dto: CreateIngestionJobDto): Promise<Record<string, unknown>> {
    const parameters = this.toJsonValue(dto.parameters ?? null);
    const job = await this.prisma.ingestionJob.create({
      data: {
        jobType: dto.jobType,
        status: IngestionJobStatus.QUEUED,
        parameters
      }
    });

    await this.prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.RUNNING,
        startedAt: new Date()
      }
    });

    try {
      const summary = await this.runJob(dto.jobType, dto.parameters ?? {});
      const completedJob = await this.prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: IngestionJobStatus.SUCCEEDED,
          finishedAt: new Date(),
          errorMessage: null
        }
      });

      return {
        data: {
          ...this.formatJob(completedJob),
          summary
        },
        meta: {
          source: "database"
        }
      };
    } catch (error) {
      const errorMessage = this.toErrorMessage(error);
      const failedJob = await this.prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: IngestionJobStatus.FAILED,
          finishedAt: new Date(),
          errorMessage
        }
      });

      return {
        data: this.formatJob(failedJob),
        meta: {
          source: "database",
          error: errorMessage
        }
      };
    }
  }

  private async runJob(jobType: IngestionJobType, parameters: JsonRecord): Promise<IngestionSummary> {
    switch (jobType) {
      case IngestionJobType.STOCK_MASTER:
        return this.ingestStockMaster(parameters);
      case IngestionJobType.PRICE_DAILY:
        return this.ingestDailyPrices(parameters);
      case IngestionJobType.MARKET_DOCUMENTS:
        return this.ingestMarketDocuments(parameters);
      default:
        throw new Error(`Unsupported ingestion job type: ${jobType}`);
    }
  }

  private async ingestStockMaster(parameters: JsonRecord): Promise<IngestionSummary> {
    const stocks = this.resolveStocks(parameters);
    if (stocks.length === 0) {
      throw new Error("At least one stock must be provided in parameters.stocks or parameters.symbols.");
    }

    for (const stock of stocks) {
      await this.upsertStock(stock);
    }

    return {
      stocksUpserted: stocks.length,
      pricesUpserted: 0,
      documentsUpserted: 0,
      sourceErrors: []
    };
  }

  private async ingestDailyPrices(parameters: JsonRecord): Promise<IngestionSummary> {
    const stocks = this.resolveStocks(parameters);
    if (stocks.length === 0) {
      throw new Error("At least one stock symbol must be provided for price_daily ingestion.");
    }

    const window = this.resolveDateWindow(parameters);
    const sourceErrors: string[] = [];
    let stocksUpserted = 0;
    let pricesUpserted = 0;

    for (const stockSeed of stocks) {
      const stock = await this.upsertStock(stockSeed);
      stocksUpserted += 1;

      try {
        const rows = await this.fetchStooqDailyPrices(stockSeed, window);
        for (const row of rows) {
          await this.prisma.priceDaily.upsert({
            where: {
              stockId_tradeDate: {
                stockId: stock.id,
                tradeDate: this.dateOnly(row.tradeDate)
              }
            },
            update: {
              openPrice: row.openPrice,
              highPrice: row.highPrice,
              lowPrice: row.lowPrice,
              closePrice: row.closePrice,
              volume: row.volume,
              source: row.source
            },
            create: {
              stockId: stock.id,
              tradeDate: this.dateOnly(row.tradeDate),
              openPrice: row.openPrice,
              highPrice: row.highPrice,
              lowPrice: row.lowPrice,
              closePrice: row.closePrice,
              volume: row.volume,
              source: row.source
            }
          });
          pricesUpserted += 1;
        }
      } catch (error) {
        sourceErrors.push(`${stockSeed.symbol}: ${this.toErrorMessage(error)}`);
      }
    }

    if (pricesUpserted === 0 && sourceErrors.length > 0) {
      throw new Error(sourceErrors.join("; "));
    }

    return {
      stocksUpserted,
      pricesUpserted,
      documentsUpserted: 0,
      sourceErrors
    };
  }

  private async ingestMarketDocuments(parameters: JsonRecord): Promise<IngestionSummary> {
    const stocks = this.resolveStocks(parameters);
    if (stocks.length === 0) {
      throw new Error("At least one stock symbol must be provided for market_documents ingestion.");
    }

    const window = this.resolveDateWindow(parameters);
    const limit = this.getNumberParameter(parameters, "limit", DEFAULT_DOCUMENT_LIMIT);
    const includeNews = this.getBooleanParameter(parameters, "includeNews", true);
    const includeDisclosures = this.getBooleanParameter(
      parameters,
      "includeDisclosures",
      Boolean(this.configService.get<string>("DART_API_KEY"))
    );
    const sourceErrors: string[] = [];
    let stocksUpserted = 0;
    let documentsUpserted = 0;

    for (const stockSeed of stocks) {
      const stock = await this.upsertStock(stockSeed);
      stocksUpserted += 1;

      const documentRows: DocumentRow[] = [];

      if (includeNews) {
        try {
          documentRows.push(...(await this.fetchGoogleNewsDocuments(stockSeed, window, limit)));
        } catch (error) {
          sourceErrors.push(`${stockSeed.symbol}/${GOOGLE_NEWS_SOURCE}: ${this.toErrorMessage(error)}`);
        }
      }

      if (includeDisclosures) {
        try {
          documentRows.push(...(await this.fetchDartDisclosures(stockSeed, window, limit, parameters)));
        } catch (error) {
          sourceErrors.push(`${stockSeed.symbol}/${OPENDART_SOURCE}: ${this.toErrorMessage(error)}`);
        }
      }

      for (const documentRow of documentRows) {
        await this.prisma.marketDocument.upsert({
          where: {
            contentHash: documentRow.contentHash
          },
          update: {
            stockId: stock.id,
            title: documentRow.title,
            body: documentRow.body,
            source: documentRow.source,
            sourceUrl: documentRow.sourceUrl,
            publishedAt: documentRow.publishedAt
          },
          create: {
            stockId: stock.id,
            documentType: documentRow.documentType,
            title: documentRow.title,
            body: documentRow.body,
            source: documentRow.source,
            sourceUrl: documentRow.sourceUrl,
            publishedAt: documentRow.publishedAt,
            contentHash: documentRow.contentHash
          }
        });
        documentsUpserted += 1;
      }
    }

    if (documentsUpserted === 0 && sourceErrors.length > 0) {
      throw new Error(sourceErrors.join("; "));
    }

    return {
      stocksUpserted,
      pricesUpserted: 0,
      documentsUpserted,
      sourceErrors
    };
  }

  private async upsertStock(stock: StockSeed): Promise<{ id: string; symbol: string }> {
    return this.prisma.stock.upsert({
      where: {
        symbol: stock.symbol
      },
      update: {
        name: stock.name,
        market: stock.market,
        sector: stock.sector,
        isActive: true
      },
      create: {
        symbol: stock.symbol,
        name: stock.name,
        market: stock.market,
        sector: stock.sector,
        isActive: true
      },
      select: {
        id: true,
        symbol: true
      }
    });
  }

  private async fetchStooqDailyPrices(stock: StockSeed, window: DateWindow): Promise<PriceRow[]> {
    const stooqSymbol = this.resolveStooqSymbol(stock);
    const url = new URL("https://stooq.com/q/d/l/");
    url.searchParams.set("s", stooqSymbol);
    url.searchParams.set("d1", this.compactDate(window.from));
    url.searchParams.set("d2", this.compactDate(window.to));
    url.searchParams.set("i", "d");

    const csv = await this.fetchTextWithRetry(url.toString(), STOOQ_SOURCE);
    const rows = this.parseCsv(csv);
    if (rows.length === 0) {
      throw new Error(`No Stooq price rows returned for ${stooqSymbol}.`);
    }

    return rows.map((row) => {
      const date = this.requireCsvValue(row, "Date", stooqSymbol);
      return {
        tradeDate: date,
        openPrice: this.requireCsvValue(row, "Open", stooqSymbol),
        highPrice: this.requireCsvValue(row, "High", stooqSymbol),
        lowPrice: this.requireCsvValue(row, "Low", stooqSymbol),
        closePrice: this.requireCsvValue(row, "Close", stooqSymbol),
        volume: BigInt(this.requireCsvValue(row, "Volume", stooqSymbol)),
        source: STOOQ_SOURCE
      };
    });
  }

  private async fetchGoogleNewsDocuments(
    stock: StockSeed,
    window: DateWindow,
    limit: number
  ): Promise<DocumentRow[]> {
    const query = stock.newsQuery ?? (stock.name === stock.symbol ? stock.symbol : `${stock.name} ${stock.symbol}`);
    const url = new URL("https://news.google.com/rss/search");
    url.searchParams.set("q", query);
    url.searchParams.set("hl", "ko");
    url.searchParams.set("gl", "KR");
    url.searchParams.set("ceid", "KR:ko");

    const xml = await this.fetchTextWithRetry(url.toString(), GOOGLE_NEWS_SOURCE);
    return this.parseRssItems(xml)
      .filter((item) => this.isWithinWindow(item.publishedAt, window))
      .slice(0, limit)
      .map((item) => {
        const title = this.truncate(item.title, 500);
        const sourceUrl = this.truncate(item.link, 1000);
        const body = this.truncate(item.description || title, 10_000);
        return {
          documentType: MarketDocumentType.NEWS,
          title,
          body,
          source: GOOGLE_NEWS_SOURCE,
          sourceUrl,
          publishedAt: item.publishedAt,
          contentHash: this.contentHash(MarketDocumentType.NEWS, GOOGLE_NEWS_SOURCE, sourceUrl, title)
        };
      });
  }

  private async fetchDartDisclosures(
    stock: StockSeed,
    window: DateWindow,
    limit: number,
    parameters: JsonRecord
  ): Promise<DocumentRow[]> {
    const apiKey = this.configService.get<string>("DART_API_KEY");
    if (!apiKey) {
      throw new Error("DART_API_KEY is required when includeDisclosures is true.");
    }

    const rows: DartDisclosure[] = [];
    const maxPages = this.getNumberParameter(parameters, "dartMaxPages", DEFAULT_DART_MAX_PAGES);
    const pageCount = Math.min(Math.max(limit, 1), 100);
    let totalPages = 1;

    for (let page = 1; page <= Math.min(totalPages, maxPages) && rows.length < limit; page += 1) {
      const url = new URL("https://opendart.fss.or.kr/api/list.json");
      url.searchParams.set("crtfc_key", apiKey);
      url.searchParams.set("bgn_de", this.compactDate(window.from));
      url.searchParams.set("end_de", this.compactDate(window.to));
      url.searchParams.set("page_no", String(page));
      url.searchParams.set("page_count", String(pageCount));
      url.searchParams.set("sort", "date");
      url.searchParams.set("sort_mth", "desc");
      if (stock.dartCorpCode) {
        url.searchParams.set("corp_code", stock.dartCorpCode);
      }

      const payload = JSON.parse(await this.fetchTextWithRetry(url.toString(), OPENDART_SOURCE)) as DartListResponse;
      if (payload.status === "013") {
        break;
      }
      if (payload.status !== "000") {
        throw new Error(`OpenDART returned ${payload.status ?? "unknown"}: ${payload.message ?? "no message"}`);
      }

      totalPages = payload.total_page ?? totalPages;
      const pageRows = payload.list ?? [];
      rows.push(
        ...pageRows.filter((row) => {
          if (stock.dartCorpCode) {
            return true;
          }
          return this.normalizeSymbol(row.stock_code ?? "") === stock.symbol;
        })
      );
    }

    return rows.slice(0, limit).map((row) => {
      const receiptNo = row.rcept_no ?? "";
      const reportName = row.report_nm ?? "DART disclosure";
      const companyName = row.corp_name ?? stock.name;
      const title = this.truncate(`${companyName} ${reportName}`.trim(), 500);
      const sourceUrl = this.truncate(`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${receiptNo}`, 1000);
      const publishedAt = this.dateOnlyFromCompact(row.rcept_dt ?? window.to);
      const body = this.truncate(
        [
          `report=${reportName}`,
          `filer=${row.flr_nm ?? companyName}`,
          `receipt=${receiptNo}`,
          row.rm ? `remark=${row.rm}` : null
        ]
          .filter(Boolean)
          .join("\n"),
        10_000
      );

      return {
        documentType: MarketDocumentType.DISCLOSURE,
        title,
        body,
        source: OPENDART_SOURCE,
        sourceUrl,
        publishedAt,
        contentHash: this.contentHash(MarketDocumentType.DISCLOSURE, OPENDART_SOURCE, sourceUrl, title)
      };
    });
  }

  private async fetchTextWithRetry(url: string, source: string): Promise<string> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= DEFAULT_RETRY_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DEFAULT_REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            "User-Agent": "MarketOps-Copilot/0.1 (+public-market-data-ingestion)"
          }
        });
        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          if (retryable && attempt < DEFAULT_RETRY_ATTEMPTS) {
            await this.delay(250 * attempt);
            continue;
          }
          throw new Error(`${source} HTTP ${response.status}`);
        }
        return response.text();
      } catch (error) {
        lastError = error;
        if (attempt === DEFAULT_RETRY_ATTEMPTS) {
          break;
        }
        await this.delay(250 * attempt);
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error(`${source} request failed: ${this.toErrorMessage(lastError)}`);
  }

  private resolveStocks(parameters: JsonRecord): StockSeed[] {
    const stocksBySymbol = new Map<string, StockSeed>();
    const stockObjects = Array.isArray(parameters.stocks) ? parameters.stocks : [];
    for (const rawStock of stockObjects) {
      if (!this.isRecord(rawStock)) {
        continue;
      }
      const symbol = this.normalizeSymbol(String(rawStock.symbol ?? ""));
      if (!symbol) {
        continue;
      }
      stocksBySymbol.set(symbol, {
        symbol,
        name: String(rawStock.name ?? symbol),
        market: String(rawStock.market ?? this.inferMarket(symbol)),
        sector: rawStock.sector === undefined ? undefined : String(rawStock.sector),
        stooqSymbol: rawStock.stooqSymbol === undefined ? undefined : String(rawStock.stooqSymbol),
        dartCorpCode: rawStock.dartCorpCode === undefined ? undefined : String(rawStock.dartCorpCode),
        newsQuery: rawStock.newsQuery === undefined ? undefined : String(rawStock.newsQuery)
      });
    }

    const symbols = Array.isArray(parameters.symbols) ? parameters.symbols : [];
    for (const rawSymbol of symbols) {
      const symbol = this.normalizeSymbol(String(rawSymbol));
      if (!symbol || stocksBySymbol.has(symbol)) {
        continue;
      }
      stocksBySymbol.set(symbol, {
        symbol,
        name: symbol,
        market: this.inferMarket(symbol)
      });
    }

    return Array.from(stocksBySymbol.values());
  }

  private resolveDateWindow(parameters: JsonRecord): DateWindow {
    const to = this.normalizeDateString(
      typeof parameters.to === "string" ? parameters.to : this.formatDateOnly(new Date())
    );
    const from = this.normalizeDateString(
      typeof parameters.from === "string"
        ? parameters.from
        : this.formatDateOnly(this.addDays(this.dateOnly(to), -DEFAULT_DATE_WINDOW_DAYS))
    );

    const fromDate = this.dateOnly(from);
    const toDate = this.endOfDate(to);
    if (fromDate.getTime() > toDate.getTime()) {
      throw new Error("parameters.from must be earlier than or equal to parameters.to.");
    }

    return { from, to, fromDate, toDate };
  }

  private parseCsv(csv: string): Array<Record<string, string>> {
    const lines = csv
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length <= 1 || lines[0].toLowerCase().includes("no data")) {
      return [];
    }

    const headers = this.splitCsvLine(lines[0]);
    return lines.slice(1).map((line) => {
      const cells = this.splitCsvLine(line);
      return headers.reduce<Record<string, string>>((row, header, index) => {
        row[header] = cells[index] ?? "";
        return row;
      }, {});
    });
  }

  private splitCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (char === '"' && next === '"') {
        current += '"';
        index += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (char === "," && !inQuotes) {
        cells.push(current);
        current = "";
        continue;
      }
      current += char;
    }
    cells.push(current);
    return cells;
  }

  private parseRssItems(xml: string): Array<{ title: string; link: string; description: string; publishedAt: Date }> {
    const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
    return itemBlocks
      .map((block) => {
        const title = this.getXmlTag(block, "title");
        const link = this.getXmlTag(block, "link");
        const description = this.stripHtml(this.getXmlTag(block, "description"));
        const pubDate = this.getXmlTag(block, "pubDate");
        const publishedAt = new Date(pubDate);
        return { title, link, description, publishedAt };
      })
      .filter((item) => item.title && item.link && !Number.isNaN(item.publishedAt.getTime()));
  }

  private getXmlTag(block: string, tag: string): string {
    const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (!match) {
      return "";
    }

    return this.decodeXml(match[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "").trim());
  }

  private decodeXml(value: string): string {
    return value
      .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  }

  private stripHtml(value: string): string {
    return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  private requireCsvValue(row: Record<string, string>, key: string, symbol: string): string {
    const value = row[key];
    if (!value) {
      throw new Error(`Missing ${key} in Stooq CSV for ${symbol}.`);
    }
    return value;
  }

  private resolveStooqSymbol(stock: StockSeed): string {
    if (stock.stooqSymbol) {
      return stock.stooqSymbol;
    }
    if (/^\d{6}$/.test(stock.symbol)) {
      return `${stock.symbol}.KR`;
    }
    if (stock.symbol.includes(".")) {
      return stock.symbol;
    }
    return `${stock.symbol}.US`;
  }

  private inferMarket(symbol: string): string {
    if (/^\d{6}$/.test(symbol)) {
      return "KRX";
    }
    if (/^[A-Z]{1,5}$/.test(symbol)) {
      return "US";
    }
    return "GLOBAL";
  }

  private getBooleanParameter(parameters: JsonRecord, key: string, fallback: boolean): boolean {
    const value = parameters[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return fallback;
  }

  private getNumberParameter(parameters: JsonRecord, key: string, fallback: number): number {
    const value = parameters[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.max(1, Math.trunc(value));
    }
    if (typeof value === "string") {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) {
        return Math.max(1, parsed);
      }
    }
    return fallback;
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.trim().toUpperCase();
  }

  private normalizeDateString(value: string): string {
    const match = value.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
    if (!match) {
      throw new Error(`Invalid date value: ${value}. Expected YYYY-MM-DD or YYYYMMDD.`);
    }
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  private compactDate(value: string): string {
    return value.replaceAll("-", "");
  }

  private dateOnly(value: string): Date {
    return new Date(`${this.normalizeDateString(value)}T00:00:00.000Z`);
  }

  private endOfDate(value: string): Date {
    return new Date(`${this.normalizeDateString(value)}T23:59:59.999Z`);
  }

  private dateOnlyFromCompact(value: string): Date {
    return this.dateOnly(this.normalizeDateString(value));
  }

  private formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private isWithinWindow(date: Date, window: DateWindow): boolean {
    const time = date.getTime();
    return time >= window.fromDate.getTime() && time <= window.toDate.getTime();
  }

  private contentHash(type: MarketDocumentType, source: string, sourceUrl: string, title: string): string {
    return createHash("sha256").update([type, source, sourceUrl, title].join("|")).digest("hex");
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? value.slice(0, maxLength) : value;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (value === null || value === undefined) {
      return Prisma.JsonNull;
    }
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private formatJob(job: {
    id: string;
    jobType: string;
    status: string;
    parameters: Prisma.JsonValue | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    errorMessage: string | null;
    createdAt: Date;
  }): Record<string, unknown> {
    return {
      id: job.id,
      jobType: job.jobType,
      status: String(job.status).toLowerCase(),
      parameters: job.parameters,
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString()
    };
  }

  private isRecord(value: unknown): value is JsonRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }
}
