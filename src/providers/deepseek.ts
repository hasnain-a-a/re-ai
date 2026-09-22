import OpenAI from 'openai';
import type { McpTool, ChatOptions, ChatResult } from '../core/types.js';
import { runOpenAiCompatibleChat } from './openai-compatible.js';

export const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com';

export async function deepseekChat(
  apiKey: string,
  model: string,
  options: ChatOptions,
  tools: McpTool[],
  maxSteps: number,
  baseURL?: string,
): Promise<ChatResult> {
  const client = new OpenAI({
    apiKey,
    baseURL: baseURL || process.env.DEEPSEEK_BASE_URL || DEEPSEEK_DEFAULT_BASE_URL,
  });

  return runOpenAiCompatibleChat('deepseek', client, model, options, tools, maxSteps);
}

