import type { Provider } from './types.js';

export interface TokenPricing {
  /** Price in USD per 1 Million input tokens */
  input: number;
  /** Price in USD per 1 Million output tokens */
  output: number;
}

/**
 * Model pricing per 1 Million tokens (2025/2026 rates).
 */
export const MODEL_PRICING: Record<Exclude<Provider, 'ollama'>, Record<string, TokenPricing>> = {
  anthropic: {
    'claude-3-7-sonnet': { input: 3.0, output: 15.0 },
    'claude-3-5-sonnet': { input: 3.0, output: 15.0 },
    'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
    'claude-sonnet-4-5': { input: 3.0, output: 15.0 },
    'claude-sonnet-5': { input: 2.0, output: 10.0 },
    'claude-3-5-haiku': { input: 0.8, output: 4.0 },
    'claude-haiku-4-5': { input: 1.0, output: 5.0 },
    'claude-3-opus': { input: 15.0, output: 75.0 },
    'claude-opus-5': { input: 5.0, output: 25.0 },
    default: { input: 3.0, output: 15.0 },
  },
  openai: {
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
    'gpt-4o': { input: 2.5, output: 10.0 },
    'o3-mini': { input: 1.1, output: 4.4 },
    'o1-mini': { input: 1.1, output: 4.4 },
    'o1': { input: 15.0, output: 60.0 },
    'gpt-4.5': { input: 75.0, output: 150.0 },
    default: { input: 2.5, output: 10.0 },
  },
  gemini: {
    'gemini-2.5-flash-lite': { input: 0.075, output: 0.3 },
    'gemini-2.0-flash-lite': { input: 0.075, output: 0.3 },
    'gemini-2.5-flash': { input: 0.1, output: 0.4 },
    'gemini-2.0-flash': { input: 0.1, output: 0.4 },
    'gemini-1.5-flash': { input: 0.075, output: 0.3 },
    'gemini-2.5-pro': { input: 1.25, output: 5.0 },
    'gemini-1.5-pro': { input: 1.25, output: 5.0 },
    'gemini-3.8-flash': { input: 0.75, output: 3.75 },
    'gemini-3.1-pro': { input: 2.0, output: 12.0 },
    default: { input: 0.1, output: 0.4 },
  },
  deepseek: {
    'deepseek-chat': { input: 0.27, output: 1.1 },
    'deepseek-v3': { input: 0.27, output: 1.1 },
    'deepseek-reasoner': { input: 0.55, output: 2.19 },
    'deepseek-r1': { input: 0.55, output: 2.19 },
    'deepseek-flash': { input: 0.3, output: 1.2 },
    'deepseek-v4': { input: 0.3, output: 1.2 },
    default: { input: 0.27, output: 1.1 },
  },
};

/**
 * Calculates estimated cost in USD based on provider, model, and token counts.
 * For Ollama (local model), cost is always $0.00 as it reports tokens only.
 */
export function calculateCostUsd(
  provider: Provider,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  if (provider === 'ollama') {
    return 0;
  }

  const table = MODEL_PRICING[provider];
  if (!table) {
    return 0;
  }

  const normalizedModel = model.toLowerCase();
  
  // Try exact match or substring match (longest matching key first)
  const matchedKey = Object.keys(table)
    .filter((k) => k !== 'default')
    .sort((a, b) => b.length - a.length)
    .find((k) => normalizedModel.includes(k));

  const pricing = matchedKey ? table[matchedKey] : table.default;
  const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  
  return Number(cost.toFixed(6));
}

