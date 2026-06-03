import { describe, expect, it, jest } from "@jest/globals";
import { ConfigService } from "@nestjs/config";
import { IngestionJobStatus, MarketDocumentType } from "@prisma/client";

import { IngestionJobType } from "../src/common/market.enums";
import { IngestionService } from "../src/modules/ingestion/ingestion.service";

describe("IngestionService", () => {
  const createdAt = new Date("2026-05-30T00:00:00.000Z");

  function buildPrismaMock() {
    const job = {
      id: "job-id",
      jobType: IngestionJobType.PRICE_DAILY,
      status: IngestionJobStatus.QUEUED,
      parameters: null,
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
      createdAt
    };

    return {
      ingestionJob: {
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            ...job,
            jobType: data.jobType,
            status: data.status,
            parameters: data.parameters
          })
        ),
        update: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            ...job,
            status: data.status,
            startedAt: data.startedAt ?? job.startedAt,
            finishedAt: data.finishedAt ?? job.finishedAt,
            errorMessage: data.errorMessage ?? job.errorMessage
          })
        )
      },
      stock: {
        upsert: jest.fn().mockImplementation(() => Promise.resolve({ id: "stock-id", symbol: "005930" }))
      },
      priceDaily: {
        upsert: jest.fn().mockImplementation(() => Promise.resolve({}))
      },
      marketDocument: {
        upsert: jest.fn().mockImplementation(() => Promise.resolve({}))
      }
    };
  }

  function buildConfigMock(values: Record<string, string | undefined> = {}) {
    return {
      get: jest.fn((key: string) => values[key])
    } as unknown as ConfigService;
  }

  it("fetches Stooq daily prices and upserts them idempotently", async () => {
    const prisma = buildPrismaMock();
    const config = buildConfigMock();
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("Date,Open,High,Low,Close,Volume\n2026-05-29,75000,76000,74400,75500,12500000\n"));
    const service = new IngestionService(prisma as any, config);

    const result = (await service.createJob({
      jobType: IngestionJobType.PRICE_DAILY,
      parameters: {
        symbols: ["005930"],
        from: "2026-05-01",
        to: "2026-05-30"
      }
    })) as { data: { status: string; summary: { pricesUpserted: number } } };

    expect(result.data.status).toBe("succeeded");
    expect(result.data.summary.pricesUpserted).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("s=005930.KR"),
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(prisma.priceDaily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          stockId_tradeDate: {
            stockId: "stock-id",
            tradeDate: new Date("2026-05-29T00:00:00.000Z")
          }
        },
        create: expect.objectContaining({
          closePrice: "75500",
          volume: 12500000n,
          source: "stooq"
        })
      })
    );

    fetchMock.mockRestore();
  });

  it("fetches Google News RSS items and stores them as market documents", async () => {
    const prisma = buildPrismaMock();
    const config = buildConfigMock();
    const rss = [
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
      "<rss><channel><item>",
      "<title><![CDATA[Samsung Electronics earnings update]]></title>",
      "<link>https://news.example.com/samsung</link>",
      "<description><![CDATA[<p>Quarterly result summary</p>]]></description>",
      "<pubDate>Fri, 29 May 2026 01:00:00 GMT</pubDate>",
      "</item></channel></rss>"
    ].join("");
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(new Response(rss));
    const service = new IngestionService(prisma as any, config);

    const result = (await service.createJob({
      jobType: IngestionJobType.MARKET_DOCUMENTS,
      parameters: {
        stocks: [{ symbol: "005930", name: "Samsung Electronics", market: "KRX" }],
        from: "2026-05-01",
        to: "2026-05-30",
        includeDisclosures: false
      }
    })) as { data: { status: string; summary: { documentsUpserted: number } } };

    expect(result.data.status).toBe("succeeded");
    expect(result.data.summary.documentsUpserted).toBe(1);
    expect(prisma.marketDocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          documentType: MarketDocumentType.NEWS,
          title: "Samsung Electronics earnings update",
          body: "Quarterly result summary",
          source: "google_news_rss",
          sourceUrl: "https://news.example.com/samsung"
        })
      })
    );

    fetchMock.mockRestore();
  });

  it("records a failed job when disclosure ingestion is requested without a DART key", async () => {
    const prisma = buildPrismaMock();
    const config = buildConfigMock();
    const service = new IngestionService(prisma as any, config);

    const result = (await service.createJob({
      jobType: IngestionJobType.MARKET_DOCUMENTS,
      parameters: {
        symbols: ["005930"],
        from: "2026-05-01",
        to: "2026-05-30",
        includeNews: false,
        includeDisclosures: true
      }
    })) as { data: { status: string; errorMessage: string | null }; meta: { error?: string } };

    expect(result.data.status).toBe("failed");
    expect(result.data.errorMessage).toContain("DART_API_KEY");
    expect(result.meta.error).toContain("DART_API_KEY");
    expect(prisma.marketDocument.upsert).not.toHaveBeenCalled();
  });

  it("fetches OpenDART disclosures and stores them as market documents", async () => {
    const prisma = buildPrismaMock();
    const config = buildConfigMock({ DART_API_KEY: "test-dart-key" });
    const fetchMock = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "000",
          message: "정상",
          page_no: 1,
          total_page: 1,
          list: [
            {
              corp_code: "00126380",
              corp_name: "삼성전자",
              stock_code: "005930",
              report_nm: "분기보고서",
              rcept_no: "20260529000123",
              flr_nm: "삼성전자",
              rcept_dt: "20260529"
            }
          ]
        })
      )
    );
    const service = new IngestionService(prisma as any, config);

    const result = (await service.createJob({
      jobType: IngestionJobType.MARKET_DOCUMENTS,
      parameters: {
        stocks: [{ symbol: "005930", name: "Samsung Electronics", market: "KRX", dartCorpCode: "00126380" }],
        from: "2026-05-01",
        to: "2026-05-30",
        includeNews: false,
        includeDisclosures: true
      }
    })) as { data: { status: string; summary: { documentsUpserted: number } } };

    expect(result.data.status).toBe("succeeded");
    expect(result.data.summary.documentsUpserted).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("corp_code=00126380"),
      expect.objectContaining({ headers: expect.any(Object) })
    );
    expect(prisma.marketDocument.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          documentType: MarketDocumentType.DISCLOSURE,
          title: "삼성전자 분기보고서",
          source: "opendart",
          sourceUrl: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260529000123"
        })
      })
    );

    fetchMock.mockRestore();
  });
});
