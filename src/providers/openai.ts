import OpenAI from 'openai';
import type { McpTool, ChatOptions, ChatResult } from '../core/types.js';
import { runOpenAiCompatibleChat } from './openai-compatible.js';

export async function openaiChat(
  apiKey: string,
  model: string,
  options: ChatOptions,
  tools: McpTool[],
  maxSteps: number,
  baseURL?: string,
): Promise<ChatResult> {
  const client = new OpenAI({
    apiKey,
    baseURL: baseURL || undefined,
  });

  return runOpenAiCompatibleChat('openai', client, model, options, tools, maxSteps);
}

