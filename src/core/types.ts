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
}

export interface ChatResult {
  content: string;
  usage: { inputTokens: number; outputTokens: number; estimatedCostUsd: number };
  toolCallsExecuted: number;
}

export interface AiClientConfig {
  provider?: Provider;
  apiKey?: string;
  model?: string;
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
