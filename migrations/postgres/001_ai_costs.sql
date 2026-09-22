CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  user_id TEXT,
  endpoint_context TEXT,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0.000000,
  duration_ms INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_usage_logs_created_at ON ai_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_usage_logs_user_id ON ai_usage_logs (user_id) WHERE user_id IS NOT NULL;
