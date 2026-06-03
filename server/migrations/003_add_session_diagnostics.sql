ALTER TABLE analytics_events
ADD COLUMN IF NOT EXISTS step_index INTEGER,
ADD COLUMN IF NOT EXISTS event_group TEXT,
ADD COLUMN IF NOT EXISTS is_error BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS duration_bucket TEXT;

CREATE INDEX IF NOT EXISTS idx_analytics_events_session_ts
ON analytics_events (session_id, server_ts);

CREATE INDEX IF NOT EXISTS idx_analytics_events_flow_ts
ON analytics_events (flow_id, server_ts);

CREATE INDEX IF NOT EXISTS idx_analytics_events_is_error_ts
ON analytics_events (is_error, server_ts);

CREATE INDEX IF NOT EXISTS idx_analytics_events_group_ts
ON analytics_events (event_group, server_ts);
