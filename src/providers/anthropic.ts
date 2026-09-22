import Anthropic from '@anthropic-ai/sdk';
import type { McpTool, Message, ChatOptions, ChatResult } from '../core/types.js';

// Anthropic pricing per million tokens (as of 2024)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4': { input: 15, output: 75 },
  'claude-sonnet-4-5': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
};

function costUsd(model: string, inputTokens: number, outputTokens: number): number {
  const key = Object.keys(PRICING).find((k) => model.includes(k.split('-').slice(-2).join('-'))) ?? 'claude-sonnet-4-5';
  const p = PRICING[key] ?? PRICING['claude-sonnet-4-5'];
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export async function anthropicChat(
  apiKey: string,
  model: string,
  options: ChatOptions,
  tools: McpTool[],
  maxLoops: number,
): Promise<ChatResult> {
  const client = new Anthropic({ apiKey });

  const anthropicTools: Anthropic.Tool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool['input_schema'],
  }));

  // Build mutable message list for the agentic loop
  const messages: Anthropic.MessageParam[] = options.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let totalInput = 0;
  let totalOutput = 0;
  let toolCallsExecuted = 0;
  let finalText = '';

  for (let loop = 0; loop < maxLoops; loop++) {
    const resp = await client.messages.create({
      model,
      max_tokens: options.maxTokens ?? 1024,
      system: options.systemPrompt,
      messages,
      tools: anthropicTools.length ? anthropicTools : undefined,
    });

    totalInput += resp.usage.input_tokens;
    totalOutput += resp.usage.output_tokens;

    // Collect text blocks
    const textBlocks = resp.content.filter((b) => b.type === 'text');
    if (textBlocks.length) {
      finalText = textBlocks.map((b) => (b as Anthropic.TextBlock).text).join('');
    }

    // No tool calls → done
    const toolUseBlocks = resp.content.filter((b) => b.type === 'tool_use') as Anthropic.ToolUseBlock[];
    if (!toolUseBlocks.length || resp.stop_reason === 'end_turn') break;

    // Append assistant message with tool calls
    messages.push({ role: 'assistant', content: resp.content });

    // Execute all tool calls and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUseBlocks) {
      const tool = tools.find((t) => t.name === block.name);
      let output: string;
      if (!tool) {
        output = JSON.stringify({ error: `Unknown tool: ${block.name}` });
      } else {
        try {
          const result = await tool.execute(block.input as Record<string, unknown>);
          output = typeof result === 'string' ? result : JSON.stringify(result);
        } catch (err: unknown) {
          output = JSON.stringify({ error: String(err) });
        }
      }
      toolCallsExecuted++;
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: output });
    }

    // Append tool results as user turn
    messages.push({ role: 'user', content: toolResults });
  }

  return {
    content: finalText,
    usage: {
      inputTokens: totalInput,
      outputTokens: totalOutput,
      estimatedCostUsd: costUsd(model, totalInput, totalOutput),
    },
    toolCallsExecuted,
  };
}
