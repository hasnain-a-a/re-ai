import type { AiClientConfig, McpTool, ChatOptions, ChatResult, UsageLogEntry } from './types.js';
import { anthropicChat } from '../providers/anthropic.js';

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-1.5-pro',
  deepseek: 'deepseek-chat',
  ollama: 'llama3',
};

export class AiClient {
  private tools: McpTool[] = [];
  private config: Required<Pick<AiClientConfig, 'maxAgentLoops'>> & AiClientConfig;

  constructor(config: AiClientConfig = {}) {
    this.config = { maxAgentLoops: 10, ...config };
  }

  registerTool(tool: McpTool): this {
    this.tools.push(tool);
    return this;
  }

  registerTools(tools: McpTool[]): this {
    this.tools.push(...tools);
    return this;
  }

  async chat(options: ChatOptions): Promise<ChatResult> {
    const provider = this.config.provider ?? 'anthropic';
    const apiKey = this.config.apiKey ?? process.env[`${provider.toUpperCase()}_API_KEY`] ?? process.env.ANTHROPIC_API_KEY ?? '';
    const model = options.model ?? this.config.model ?? DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.anthropic;
    const maxLoops = this.config.maxAgentLoops;

    const start = Date.now();
    let result: ChatResult;

    if (provider === 'anthropic') {
      result = await anthropicChat(apiKey, model, options, this.tools, maxLoops);
    } else {
      throw new Error(`Provider "${provider}" not yet implemented. Use "anthropic".`);
    }

    const durationMs = Date.now() - start;

    // Telemetry
    if (this.config.telemetry) {
      const entry: UsageLogEntry = {
        provider,
        model,
        userId: options.userId,
        context: options.context,
        promptTokens: result.usage.inputTokens,
        completionTokens: result.usage.outputTokens,
        estimatedCostUsd: result.usage.estimatedCostUsd,
        durationMs,
      };
      if (this.config.telemetry.log) {
        this.config.telemetry.log(entry);
      }
      if (this.config.telemetry.postgresPool) {
        await this.config.telemetry.postgresPool.query(
          `INSERT INTO ai_usage_logs (provider, model, user_id, endpoint_context, prompt_tokens, completion_tokens, estimated_cost_usd, duration_ms)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [entry.provider, entry.model, entry.userId ?? null, entry.context ?? null,
           entry.promptTokens, entry.completionTokens, entry.estimatedCostUsd, entry.durationMs],
        ).catch((e: Error) => console.error('re-ai telemetry insert failed:', e.message));
      }
    }

    return result;
  }
}
