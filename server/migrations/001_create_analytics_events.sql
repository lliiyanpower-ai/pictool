CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  app TEXT NOT NULL DEFAULT 'image-toolbox',
  page TEXT,
  path TEXT,
  tool TEXT,
  action TEXT,
  format TEXT,
  preset TEXT,
  ratio TEXT,
  control TEXT,
  text_type TEXT,
  source TEXT,
  reason TEXT,
  status TEXT,
  strategy TEXT,
  size_bucket TEXT,
  dimension_bucket TEXT,
  target_dimension_bucket TEXT,
  output_size_bucket TEXT,
  output_dimension_bucket TEXT,
  quality_bucket TEXT,
  batch_count_bucket TEXT,
  session_id TEXT,
  flow_id TEXT,
  step_index INTEGER,
  event_group TEXT,
  is_error BOOLEAN NOT NULL DEFAULT false,
  duration_bucket TEXT,
  client_ts TIMESTAMPTZ,
  server_ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent_bucket TEXT,
  referer_host TEXT,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_server_ts
ON analytics_events (server_ts);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name_ts
ON analytics_events (event_name, server_ts);

CREATE INDEX IF NOT EXISTS idx_analytics_events_tool_ts
ON analytics_events (tool, server_ts);

CREATE INDEX IF NOT EXISTS idx_analytics_events_page_ts
ON analytics_events (page, server_ts);

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_ts
ON analytics_events (session_id, server_ts);

CREATE INDEX IF NOT EXISTS idx_analytics_events_flow_ts
ON analytics_events (flow_id, server_ts);

CREATE INDEX IF NOT EXISTS idx_analytics_events_is_error_ts
ON analytics_events (is_error, server_ts);

CREATE INDEX IF NOT EXISTS idx_analytics_events_group_ts
ON analytics_events (event_group, server_ts);
