/** Minimal pg-compatible pool — `pg.Pool` satisfies it, so re-ai needs no `pg` dependency. */
export interface UsageQueryPool {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;
}

export interface AiUsageFilters {
  days?: number | string;
  provider?: string;
  page?: number | string;
  pageSize?: number | string;
}

export interface AiUsageReport {
  summary: {
    sessions: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_cost_usd: string;
    avg_duration_ms: number;
  };
  byProvider: {
    provider: string;
    model: string;
    sessions: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_cost_usd: string;
  }[];
  byDay: { day: string; provider: string; sessions: number; cost_usd: string }[];
  sessions: {
    id: string;
    provider: string;
    model: string;
    user_id: string | null;
    endpoint_context: string | null;
    prompt_tokens: number;
    completion_tokens: number;
    estimated_cost_usd: string;
    duration_ms: number;
    created_at: string;
  }[];
  pagination: { total: number; page: number; pageSize: number; totalPages: number };
}

const toInt = (v: unknown, fallback: number) => parseInt(String(v ?? ''), 10) || fallback;

/** Aggregates `ai_usage_logs` (written by `AiClient` telemetry) for the AI Usage dashboard. */
export async function getAiUsage(pool: UsageQueryPool, filters: AiUsageFilters = {}): Promise<AiUsageReport> {
  const days = Math.min(Math.max(toInt(filters.days, 30), 1), 365);
  const page = Math.max(1, toInt(filters.page, 1));
  const pageSize = Math.min(100, Math.max(1, toInt(filters.pageSize, 25)));
  const provider = filters.provider?.trim() || null;

  // $2 is NULL when unfiltered, so one parameter list serves every query.
  const where = `created_at >= NOW() - ($1 || ' days')::interval AND ($2::text IS NULL OR provider = $2)`;
  const params = [days, provider];

  const [summary, byProvider, byDay, sessions] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS sessions,
              COALESCE(SUM(prompt_tokens),0)::int AS prompt_tokens,
              COALESCE(SUM(completion_tokens),0)::int AS completion_tokens,
              COALESCE(SUM(estimated_cost_usd),0)::numeric AS total_cost_usd,
              COALESCE(AVG(duration_ms),0)::int AS avg_duration_ms
       FROM ai_usage_logs WHERE ${where}`,
      params,
    ),
    pool.query(
      `SELECT provider, model,
              COUNT(*)::int AS sessions,
              COALESCE(SUM(prompt_tokens),0)::int AS prompt_tokens,
              COALESCE(SUM(completion_tokens),0)::int AS completion_tokens,
              COALESCE(SUM(estimated_cost_usd),0)::numeric AS total_cost_usd
       FROM ai_usage_logs WHERE ${where}
       GROUP BY provider, model ORDER BY total_cost_usd DESC`,
      params,
    ),
    pool.query(
      `SELECT DATE(created_at)::text AS day, provider,
              COUNT(*)::int AS sessions,
              COALESCE(SUM(estimated_cost_usd),0)::numeric AS cost_usd
       FROM ai_usage_logs WHERE ${where}
       GROUP BY day, provider ORDER BY day`,
      params,
    ),
    pool.query(
      `SELECT id, provider, model, user_id, endpoint_context,
              prompt_tokens, completion_tokens, estimated_cost_usd, duration_ms, created_at
       FROM ai_usage_logs WHERE ${where}
       ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [...params, pageSize, (page - 1) * pageSize],
    ),
  ]);

  const total = summary.rows[0]?.sessions ?? 0;
  return {
    summary: summary.rows[0],
    byProvider: byProvider.rows,
    byDay: byDay.rows,
    sessions: sessions.rows,
    pagination: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}
