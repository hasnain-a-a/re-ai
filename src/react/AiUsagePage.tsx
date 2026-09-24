import React, { useEffect, useState, useCallback } from 'react';
import { Badge, Button } from '@hasnain-a-a/re-ui-kit';
import {
  IconCpu,
  IconActivity,
  IconWallet,
  IconRefreshCw,
  IconSparkles,
  IconClock,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from '@hasnain-a-a/re-ui-kit/icons';

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: 'var(--accent)',
  openai: '#10a37f',
  gemini: '#4285f4',
  deepseek: '#7c3aed',
  ollama: 'var(--fg-3)',
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  deepseek: 'DeepSeek',
  ollama: 'Ollama (Local)',
};

const DAY_OPTIONS = [7, 14, 30, 90];
const PAGE_SIZE_OPTIONS = [25, 50, 100];

function fmt(n: number, decimals = 0) {
  return (n || 0).toLocaleString('en-US', { maximumFractionDigits: decimals });
}

function fmtCost(n: number) {
  if (!n || isNaN(n) || n === 0) return '$0.00';
  if (n >= 1) {
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (n >= 0.01) {
    return `$${n.toFixed(4)}`;
  }
  // Sub-cent (< $0.01): show exact micro-cost up to 6 decimals, trimming trailing zeros while keeping at least 4
  const formatted = n.toFixed(6);
  const trimmed = formatted.replace(/0+$/, '');
  const [whole, frac] = trimmed.split('.');
  const padFrac = (frac || '').length < 4 ? (frac || '').padEnd(4, '0') : frac;
  return `$${whole}.${padFrac}`;
}

function Tile({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--fg-3)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: color || 'var(--fg)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden', flex: 1, minWidth: 60 }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
    </div>
  );
}

function DaySparkline({ byDay }: { byDay: { day: string; provider: string; sessions: number; cost_usd: string }[] }) {
  if (!byDay.length) return <div style={{ color: 'var(--fg-4)', fontSize: 12, padding: '12px 0' }}>No data for this period.</div>;

  const providers = [...new Set(byDay.map((r) => r.provider))];
  const dateMap: Record<string, Record<string, number>> = {};
  byDay.forEach((r) => {
    dateMap[r.day] = dateMap[r.day] || {};
    dateMap[r.day][r.provider] = (dateMap[r.day][r.provider] || 0) + r.sessions;
  });

  const dates = Object.keys(dateMap).sort();
  const maxVal = Math.max(...dates.map((d) => providers.reduce((s, p) => s + (dateMap[d][p] || 0), 0)), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
        {providers.map((p) => (
          <div key={p} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: PROVIDER_COLORS[p] || 'var(--fg-3)', display: 'inline-block' }} />
            {PROVIDER_LABELS[p] || p}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 64 }}>
        {dates.map((day) => {
          const total = providers.reduce((s, p) => s + (dateMap[day][p] || 0), 0);
          const pct = total / maxVal;
          return (
            <div
              key={day}
              title={`${day}: ${total} sessions`}
              style={{ flex: 1, height: `${Math.max(pct * 100, 4)}%`, background: PROVIDER_COLORS[providers[0]] || 'var(--accent)', borderRadius: '2px 2px 0 0', opacity: 0.8, cursor: 'default', minWidth: 3 }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--fg-4)' }}>
        <span>{dates[0]}</span>
        <span>{dates[dates.length - 1]}</span>
      </div>
    </div>
  );
}

export interface AiUsagePageProps {
  /** Base URL of the API that mounts `ReAiUsageModule` (e.g. `https://api.example.com`). */
  apiBase?: string;
  /** Authenticated fetch from the host app (e.g. re-auth's `authFetch`). Defaults to `fetch`. */
  fetcher?: (url: string, init?: RequestInit) => Promise<Response>;
}

const SKELETON: React.CSSProperties = { background: 'var(--surface-2)', animation: 're-ai-pulse 1.4s ease-in-out infinite' };

export function AiUsagePage({ apiBase = '', fetcher = (url, init) => fetch(url, init) }: AiUsagePageProps) {
  const [days, setDays] = useState(30);
  const [providerFilter, setProviderFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        days: String(days),
        page: String(page),
        pageSize: String(pageSize),
      });
      if (providerFilter) qs.set('provider', providerFilter);
      const res = await fetcher(`${apiBase}/api/ai/usage?${qs}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetcher is often an inline closure
  }, [days, providerFilter, page, pageSize, apiBase]);

  useEffect(() => { load(); }, [load]);

  const handleDaysChange = (d: number) => {
    setDays(d);
    setPage(1);
  };

  const handleProviderChange = (p: string) => {
    setProviderFilter(p);
    setPage(1);
  };

  const handlePageSizeChange = (sz: number) => {
    setPageSize(sz);
    setPage(1);
  };

  const summary = data?.summary ?? {};
  const byProvider: any[] = data?.byProvider ?? [];
  const byDay: any[] = data?.byDay ?? [];
  const sessions: any[] = data?.sessions ?? data?.recent ?? [];
  const pagination = data?.pagination;
  const totalSessions = pagination?.total ?? (summary.sessions || 0);
  const totalPages = Math.max(1, pagination?.totalPages || Math.ceil(totalSessions / pageSize));

  // All providers that ever appeared (for filter tabs)
  const seenProviders = [...new Set([...byProvider.map((r: any) => r.provider), ...sessions.map((r: any) => r.provider)])];
  const maxCost = Math.max(...byProvider.map((r: any) => parseFloat(r.total_cost_usd) || 0), 0.0001);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <style>{'@keyframes re-ai-pulse{0%,100%{opacity:1}50%{opacity:.45}}'}</style>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700 }}>AI Usage</h1>
          <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Cross-provider token consumption, cost tracking, and session history.</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Day range */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: 2, border: '1px solid var(--border)' }}>
            {DAY_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDaysChange(d)}
                style={{
                  padding: '4px 12px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: days === d ? 'var(--accent)' : 'transparent',
                  color: days === d ? '#fff' : 'var(--fg-2)',
                }}
              >
                {d}d
              </button>
            ))}
          </div>
          {/* Provider filter */}
          <div style={{ display: 'flex', gap: 2, background: 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: 2, border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => handleProviderChange('')}
              style={{ padding: '4px 10px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: !providerFilter ? 'var(--accent)' : 'transparent', color: !providerFilter ? '#fff' : 'var(--fg-2)' }}
            >
              All
            </button>
            {seenProviders.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handleProviderChange(p === providerFilter ? '' : p)}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: providerFilter === p ? PROVIDER_COLORS[p] || 'var(--fg)' : 'transparent',
                  color: providerFilter === p ? '#fff' : 'var(--fg-2)',
                }}
              >
                {PROVIDER_LABELS[p] || p}
              </button>
            ))}
          </div>
          <Button size="sm" variant="secondary" icon={<IconRefreshCw size={13} />} onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <Tile icon={<IconSparkles size={13} />} label="Total Sessions" value={loading && !data ? '—' : fmt(summary.sessions || 0)} sub={`last ${days} days`} />
        <Tile icon={<IconWallet size={13} />} label="Total Cost" value={loading && !data ? '—' : fmtCost(parseFloat(summary.total_cost_usd) || 0)} color="var(--accent)" sub="estimated USD" />
        <Tile icon={<IconActivity size={13} />} label="Prompt Tokens" value={loading && !data ? '—' : fmt(summary.prompt_tokens || 0)} sub="input" />
        <Tile icon={<IconCpu size={13} />} label="Output Tokens" value={loading && !data ? '—' : fmt(summary.completion_tokens || 0)} sub="completion" />
        <Tile icon={<IconClock size={13} />} label="Avg Latency" value={loading && !data ? '—' : `${fmt(summary.avg_duration_ms || 0)}ms`} sub="per session" />
      </div>

      {/* Provider breakdown + sparkline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* By provider/model */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <IconCpu size={14} style={{ color: 'var(--fg-3)' }} />
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>By Provider & Model</span>
            <Badge tone="neutral">{byProvider.length}</Badge>
          </div>
          {loading && !data ? (
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ ...SKELETON,  height: 36, width: '100%', borderRadius: 6 }} />
              <div style={{ ...SKELETON,  height: 36, width: '100%', borderRadius: 6 }} />
            </div>
          ) : byProvider.length === 0 ? (
            <div style={{ padding: 32, color: 'var(--fg-3)', fontSize: 13, textAlign: 'center' }}>No sessions yet in this period.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {byProvider.map((row: any, i: number) => {
                const cost = parseFloat(row.total_cost_usd) || 0;
                const pct = (cost / maxCost) * 100;
                const color = PROVIDER_COLORS[row.provider] || 'var(--fg-3)';
                return (
                  <div key={i} style={{ padding: '12px 20px', borderBottom: i < byProvider.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--fg)' }}>{row.model}</span>
                        <span style={{ marginLeft: 8 }}>
                          <Badge tone="neutral" style={{ fontSize: 10, background: color + '22', color }}>{PROVIDER_LABELS[row.provider] || row.provider}</Badge>
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--fg-2)' }}>
                        <span>{fmt(row.sessions)} sessions</span>
                        <span style={{ fontWeight: 700, color }}>{fmtCost(cost)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <MiniBar pct={pct} color={color} />
                      <span style={{ fontSize: 10, color: 'var(--fg-4)', whiteSpace: 'nowrap' }}>
                        {fmt(row.prompt_tokens + row.completion_tokens)} tok
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Daily sparkline */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: '14px 20px' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
            <IconActivity size={14} style={{ color: 'var(--fg-3)' }} />
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>Sessions per Day</span>
          </div>
          {loading && !data ? (
            <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ ...SKELETON,  height: 48, width: '100%', borderRadius: 4 }} />
            </div>
          ) : (
            <DaySparkline byDay={byDay} />
          )}

          {/* Cost by day summary */}
          {!loading && byDay.length > 0 && (
            <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8 }}>Cost by Provider</div>
              {Object.entries(
                byDay.reduce<Record<string, number>>((acc, r) => {
                  acc[r.provider] = (acc[r.provider] || 0) + parseFloat(r.cost_usd);
                  return acc;
                }, {})
              ).sort((a, b) => b[1] - a[1]).map(([prov, cost]) => (
                <div key={prov} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0' }}>
                  <span style={{ color: PROVIDER_COLORS[prov] || 'var(--fg-3)', fontWeight: 600 }}>{PROVIDER_LABELS[prov] || prov}</span>
                  <span style={{ color: 'var(--fg)', fontWeight: 700 }}>{fmtCost(cost)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Session history table */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <IconActivity size={14} style={{ color: 'var(--accent)' }} />
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>Session History</span>
            <Badge tone="neutral">{loading && !data ? '…' : fmt(totalSessions)}</Badge>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--fg-3)' }}>
            <span>Ordered latest to oldest</span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Time', 'Provider', 'Model', 'Context', 'User', 'Tokens (in/out)', 'Cost', 'Latency'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: Math.min(pageSize, 8) }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px' }}><div style={{ ...SKELETON,  width: 110, height: 13, borderRadius: 4 }} /></td>
                    <td style={{ padding: '12px 14px' }}><div style={{ ...SKELETON,  width: 75, height: 20 }} /></td>
                    <td style={{ padding: '12px 14px' }}><div style={{ ...SKELETON,  width: 140, height: 13, borderRadius: 4 }} /></td>
                    <td style={{ padding: '12px 14px' }}><div style={{ ...SKELETON,  width: 160, height: 13, borderRadius: 4 }} /></td>
                    <td style={{ padding: '12px 14px' }}><div style={{ ...SKELETON,  width: 60, height: 13, borderRadius: 4 }} /></td>
                    <td style={{ padding: '12px 14px' }}><div style={{ ...SKELETON,  width: 80, height: 13, borderRadius: 4 }} /></td>
                    <td style={{ padding: '12px 14px' }}><div style={{ ...SKELETON,  width: 65, height: 13, borderRadius: 4 }} /></td>
                    <td style={{ padding: '12px 14px' }}><div style={{ ...SKELETON,  width: 50, height: 13, borderRadius: 4 }} /></td>
                  </tr>
                ))
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 36, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
                    No sessions recorded for the selected period.
                  </td>
                </tr>
              ) : (
                sessions.map((row: any, i: number) => {
                  const color = PROVIDER_COLORS[row.provider] || 'var(--fg-3)';
                  const cost = parseFloat(row.estimated_cost_usd) || 0;
                  return (
                    <tr key={row.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>
                        {new Date(row.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <Badge tone="neutral" style={{ fontSize: 10, background: color + '22', color }}>{PROVIDER_LABELS[row.provider] || row.provider}</Badge>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, color: 'var(--fg-2)' }}>{row.model}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--fg-2)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.endpoint_context || '—'}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--fg-3)', fontFamily: 'monospace', fontSize: 11 }}>{row.user_id || '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11 }}>
                        <span style={{ color: 'var(--fg-2)' }}>{fmt(row.prompt_tokens)}</span>
                        <span style={{ color: 'var(--fg-4)' }}> / </span>
                        <span style={{ color: 'var(--accent)' }}>{fmt(row.completion_tokens)}</span>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color, whiteSpace: 'nowrap' }}>{fmtCost(cost)}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--fg-3)', fontFamily: 'monospace', fontSize: 11 }}>{fmt(row.duration_ms)}ms</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination toolbar */}
        {totalSessions > 0 && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface-2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              fontSize: 12,
            }}
          >
            {/* Left: Summary */}
            <div style={{ color: 'var(--fg-3)' }}>
              Showing{' '}
              <strong style={{ color: 'var(--fg)' }}>
                {fmt((page - 1) * pageSize + 1)}
              </strong>
              {'–'}
              <strong style={{ color: 'var(--fg)' }}>
                {fmt(Math.min(page * pageSize, totalSessions))}
              </strong>
              {' of '}
              <strong style={{ color: 'var(--fg)' }}>
                {fmt(totalSessions)}
              </strong>
              {' sessions'}
            </div>

            {/* Right: Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {/* Page size selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-3)' }}>
                <span>Rows:</span>
                <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', borderRadius: 'var(--r-sm)', padding: 2, border: '1px solid var(--border)' }}>
                  {PAGE_SIZE_OPTIONS.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => handlePageSizeChange(sz)}
                      disabled={loading}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--r-xs, 4px)',
                        border: 'none',
                        cursor: loading ? 'default' : 'pointer',
                        fontSize: 11,
                        fontWeight: 600,
                        background: pageSize === sz ? 'var(--accent)' : 'transparent',
                        color: pageSize === sz ? '#fff' : 'var(--fg-2)',
                      }}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  type="button"
                  onClick={() => setPage(1)}
                  disabled={page <= 1 || loading}
                  title="First page"
                  style={{
                    padding: '4px 6px',
                    borderRadius: 'var(--r-sm, 4px)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: page <= 1 || loading ? 'var(--fg-4)' : 'var(--fg)',
                    cursor: page <= 1 || loading ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <IconChevronsLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  title="Previous page"
                  style={{
                    padding: '4px 6px',
                    borderRadius: 'var(--r-sm, 4px)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: page <= 1 || loading ? 'var(--fg-4)' : 'var(--fg)',
                    cursor: page <= 1 || loading ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <IconChevronLeft size={14} />
                </button>

                <span style={{ padding: '0 8px', color: 'var(--fg-2)', fontWeight: 550, whiteSpace: 'nowrap' }}>
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                  title="Next page"
                  style={{
                    padding: '4px 6px',
                    borderRadius: 'var(--r-sm, 4px)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: page >= totalPages || loading ? 'var(--fg-4)' : 'var(--fg)',
                    cursor: page >= totalPages || loading ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <IconChevronRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setPage(totalPages)}
                  disabled={page >= totalPages || loading}
                  title="Last page"
                  style={{
                    padding: '4px 6px',
                    borderRadius: 'var(--r-sm, 4px)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: page >= totalPages || loading ? 'var(--fg-4)' : 'var(--fg)',
                    cursor: page >= totalPages || loading ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <IconChevronsRight size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
