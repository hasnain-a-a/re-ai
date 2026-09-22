export type Provider = 'anthropic' | 'openai' | 'gemini' | 'deepseek' | 'ollama';

export interface McpTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description?: string; enum?: string[] }>;
    required?: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  messages: Message[];
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  context?: string;
  userId?: string;
  /** Maximum number of agentic steps (LLM call + tool execution cycles). Default: 1 */
  maxSteps?: number;
  /** Optional tools to use for this specific chat call (merged with registered tools) */
  tools?: McpTool[];
}

export interface ChatResult {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  toolCallsExecuted: number;
  /** Execution duration from start to end in milliseconds */
  durationMs: number;
}

export interface AiClientConfig {
  provider?: Provider;
  apiKey?: string;
  model?: string;
  /** Custom base URL for the API (e.g. for Ollama host, DeepSeek, or custom proxies) */
  baseURL?: string;
  /** Maximum number of agentic steps (LLM call + tool execution cycles). Default: 1 */
  maxSteps?: number;
  /** Backwards-compatible alias for maxSteps */
  maxAgentLoops?: number;
  telemetry?: {
    postgresPool?: { query: (sql: string, params?: unknown[]) => Promise<unknown> };
    log?: (entry: UsageLogEntry) => void;
  };
}

export interface UsageLogEntry {
  provider: string;
  model: string;
  userId?: string;
  context?: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  durationMs: number;
}
