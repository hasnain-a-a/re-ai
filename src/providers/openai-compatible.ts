import OpenAI from 'openai';
import type { McpTool, ChatOptions, ChatResult, Provider } from '../core/types.js';
import { calculateCostUsd } from '../core/pricing.js';

export async function runOpenAiCompatibleChat(
  provider: Provider,
  client: OpenAI,
  model: string,
  options: ChatOptions,
  tools: McpTool[],
  maxSteps: number,
): Promise<ChatResult> {
  const openAiTools: OpenAI.ChatCompletionTool[] = tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as Record<string, unknown>,
    },
  }));

  const messages: OpenAI.ChatCompletionMessageParam[] = [];

  if (options.systemPrompt) {
    messages.push({
      role: 'system',
      content: options.systemPrompt,
    });
  }

  for (const m of options.messages) {
    messages.push({
      role: m.role,
      content: m.content,
    });
  }

  let totalInput = 0;
  let totalOutput = 0;
  let toolCallsExecuted = 0;
  let finalText = '';

  for (let step = 0; step < maxSteps; step++) {
    const resp = await client.chat.completions.create({
      model,
      messages,
      max_tokens: options.maxTokens,
      tools: openAiTools.length ? openAiTools : undefined,
    });

    if (resp.usage) {
      totalInput += resp.usage.prompt_tokens ?? 0;
      totalOutput += resp.usage.completion_tokens ?? 0;
    }

    const choice = resp.choices?.[0];
    if (!choice) {
      break;
    }

    if (choice.message.content) {
      finalText = choice.message.content;
    }

    const toolCalls = choice.message.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      break;
    }

    // Append assistant's turn with tool calls to conversation history
    messages.push(choice.message);

    // Execute tool calls
    for (const toolCall of toolCalls) {
      // Skip if not a standard function tool call
      if (toolCall.type !== 'function') continue;

      const tool = tools.find((t) => t.name === toolCall.function.name);
      let output: string;

      if (!tool) {
        output = JSON.stringify({ error: `Unknown tool: ${toolCall.function.name}` });
      } else {
        try {
          const args = JSON.parse(toolCall.function.arguments || '{}');
          const result = await tool.execute(args);
          output = typeof result === 'string' ? result : JSON.stringify(result);
        } catch (err: unknown) {
          output = JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
        }
      }

      toolCallsExecuted++;
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: output,
      });
    }

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
      estimatedCostUsd: calculateCostUsd(provider, model, totalInput, totalOutput),
    },
    toolCallsExecuted,
    durationMs: 0,
  };
}

