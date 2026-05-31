export enum MarketEventSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical"
}

export enum MarketEventType {
  PRICE_SPIKE = "price_spike",
  VOLUME_SPIKE = "volume_spike",
  KEYWORD_ALERT = "keyword_alert"
}

export enum IngestionJobType {
  STOCK_MASTER = "stock_master",
  PRICE_DAILY = "price_daily",
  MARKET_DOCUMENTS = "market_documents"
}
