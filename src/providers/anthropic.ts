import Anthropic from '@anthropic-ai/sdk';
import type { McpTool, ChatOptions, ChatResult } from '../core/types.js';
import { calculateCostUsd } from '../core/pricing.js';

export async function anthropicChat(
  apiKey: string,
  model: string,
  options: ChatOptions,
  tools: McpTool[],
  maxSteps: number,
  baseURL?: string,
): Promise<ChatResult> {
  const client = new Anthropic({
    apiKey,
    baseURL: baseURL || undefined,
  });

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

  for (let step = 0; step < maxSteps; step++) {
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
          output = JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
        }
      }
      toolCallsExecuted++;
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: output });
    }

    // Append tool results as user turn
    messages.push({ role: 'user', content: toolResults });

    // If max steps reached after tool calls, break
    if (step + 1 >= maxSteps) {
      break;
    }
  }

  return {
    content: finalText,
    usage: {
      inputTokens: totalInput,
      outputTokens: totalOutput,
      totalTokens: totalInput + totalOutput,
      estimatedCostUsd: calculateCostUsd('anthropic', model, totalInput, totalOutput),
    },
    toolCallsExecuted,
    durationMs: 0,
  };
}
