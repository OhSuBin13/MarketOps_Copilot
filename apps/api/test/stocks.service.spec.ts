import { describe, expect, it } from "@jest/globals";

import { StocksService } from "../src/modules/stocks/stocks.service";

describe("StocksService", () => {
  it("returns the week 1 placeholder stock list", () => {
    const service = new StocksService();

    const result = service.findAll() as { data: Array<{ symbol: string }>; meta: { count: number } };

    expect(result.meta.count).toBe(1);
    expect(result.data[0].symbol).toBe("005930");
  });

  it("returns an empty placeholder price series with the requested range", () => {
    const service = new StocksService();

    const result = service.findPrices("stock-id", {
      from: "2026-05-01",
      to: "2026-05-30"
    }) as { data: unknown[]; meta: { from: string; to: string } };

    expect(result.data).toEqual([]);
    expect(result.meta.from).toBe("2026-05-01");
    expect(result.meta.to).toBe("2026-05-30");
  });
});
