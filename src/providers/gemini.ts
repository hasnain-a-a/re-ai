import OpenAI from 'openai';
import type { McpTool, ChatOptions, ChatResult } from '../core/types.js';
import { runOpenAiCompatibleChat } from './openai-compatible.js';

export const GEMINI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';

export async function geminiChat(
  apiKey: string,
  model: string,
  options: ChatOptions,
  tools: McpTool[],
  maxSteps: number,
  baseURL?: string,
): Promise<ChatResult> {
  const client = new OpenAI({
    apiKey,
    baseURL: baseURL || process.env.GEMINI_BASE_URL || GEMINI_DEFAULT_BASE_URL,
  });

  return runOpenAiCompatibleChat('gemini', client, model, options, tools, maxSteps);
}

