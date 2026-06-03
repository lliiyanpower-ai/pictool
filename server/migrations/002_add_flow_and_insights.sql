ALTER TABLE analytics_events
ADD COLUMN IF NOT EXISTS flow_id TEXT;

CREATE INDEX IF NOT EXISTS idx_analytics_events_flow_ts
ON analytics_events (flow_id, server_ts);

CREATE TABLE IF NOT EXISTS analytics_insights (
  id BIGSERIAL PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  metric_name TEXT,
  metric_value NUMERIC,
  baseline_value NUMERIC,
  related_tool TEXT,
  related_event TEXT,
  related_dimension TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_insights_period
ON analytics_insights (period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_analytics_insights_type_severity
ON analytics_insights (type, severity);
