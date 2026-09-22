import OpenAI from 'openai';
import type { McpTool, ChatOptions, ChatResult } from '../core/types.js';
import { runOpenAiCompatibleChat } from './openai-compatible.js';

export const OLLAMA_DEFAULT_HOST = 'http://127.0.0.1:11434';

export async function ollamaChat(
  model: string,
  options: ChatOptions,
  tools: McpTool[],
  maxSteps: number,
  baseURL?: string,
  apiKey?: string,
): Promise<ChatResult> {
  const rawHost = baseURL || process.env.OLLAMA_HOST || process.env.OLLAMA_BASE_URL || OLLAMA_DEFAULT_HOST;
  const normalizedHost = rawHost.replace(/\/$/, '');
  const v1Endpoint = normalizedHost.endsWith('/v1') ? normalizedHost : `${normalizedHost}/v1`;

  const client = new OpenAI({
    apiKey: apiKey || process.env.OLLAMA_API_KEY || 'ollama',
    baseURL: v1Endpoint,
  });

  try {
    const result = await runOpenAiCompatibleChat('ollama', client, model, options, tools, maxSteps);
    // Explicitly guarantee zero cost for Ollama while preserving token counts
    result.usage.estimatedCostUsd = 0;
    return result;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('ECONNREFUSED') || msg.includes('fetch failed')) {
      throw new Error(
        `Failed to connect to Ollama at ${normalizedHost}. Ensure Ollama is running (e.g. 'ollama serve') and model '${model}' is available (e.g. 'ollama pull ${model}'). Original error: ${msg}`,
      );
    }
    throw error;
  }
}

