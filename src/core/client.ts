import type { AiClientConfig, McpTool, ChatOptions, ChatResult, UsageLogEntry, Provider } from './types.js';
import { anthropicChat } from '../providers/anthropic.js';
import { openaiChat } from '../providers/openai.js';
import { geminiChat } from '../providers/gemini.js';
import { deepseekChat } from '../providers/deepseek.js';
import { ollamaChat } from '../providers/ollama.js';

export const SUPPORTED_PROVIDERS: readonly Provider[] = [
  'anthropic',
  'openai',
  'gemini',
  'deepseek',
  'ollama',
] as const;

export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-3-7-sonnet-20250219',
  openai: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
  deepseek: 'deepseek-chat',
  ollama: 'llama3.2',
};

export class AiClient {
  private tools: McpTool[] = [];
  private config: Required<Pick<AiClientConfig, 'maxSteps'>> & AiClientConfig;

  constructor(config: AiClientConfig = {}) {
    const maxSteps = config.maxSteps ?? config.maxAgentLoops ?? 1;
    this.config = {
      ...config,
      maxSteps,
    };
  }

  registerTool(tool: McpTool): this {
    this.tools.push(tool);
    return this;
  }

  registerTools(tools: McpTool[]): this {
    this.tools.push(...tools);
    return this;
  }

  /**
   * Resolves the provider from config or environment.
   */
  resolveProvider(): Provider {
    const provider = this.config.provider ?? (process.env.AI_PROVIDER as Provider) ?? 'anthropic';
    if (!SUPPORTED_PROVIDERS.includes(provider)) {
      throw new Error(
        `Unsupported provider "${provider}". Supported providers are: ${SUPPORTED_PROVIDERS.join(', ')}.`,
      );
    }
    return provider;
  }

  /**
   * Resolves the model name according to priority:
   * 1. Call options.model
   * 2. Client config.model
   * 3. Provider-specific env var (e.g. ANTHROPIC_MODEL, OPENAI_MODEL, GEMINI_MODEL, DEEPSEEK_MODEL, OLLAMA_MODEL)
   * 4. General DEFAULT_MODEL env var
   * 5. Built-in default model for provider
   */
  resolveModel(provider: Provider, optionsModel?: string): string {
    const envProviderModel = process.env[`${provider.toUpperCase()}_MODEL`];
    const envDefaultModel = process.env.DEFAULT_MODEL;

    return (
      optionsModel ??
      this.config.model ??
      envProviderModel ??
      envDefaultModel ??
      DEFAULT_MODELS[provider]
    );
  }

  /**
   * Resolves and validates API keys for the given provider.
   */
  private resolveApiKey(provider: Provider): string {
    let key: string | undefined;

    switch (provider) {
      case 'anthropic':
        key = this.config.apiKey ?? process.env.ANTHROPIC_API_KEY;
        if (!key) {
          throw new Error(
            'Missing API key for provider "anthropic". Please set ANTHROPIC_API_KEY environment variable or provide apiKey in AiClientConfig.',
          );
        }
        return key;

      case 'openai':
        key = this.config.apiKey ?? process.env.OPENAI_API_KEY;
        if (!key) {
          throw new Error(
            'Missing API key for provider "openai". Please set OPENAI_API_KEY environment variable or provide apiKey in AiClientConfig.',
          );
        }
        return key;

      case 'gemini':
        key = this.config.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
        if (!key) {
          throw new Error(
            'Missing API key for provider "gemini". Please set GEMINI_API_KEY (or GOOGLE_API_KEY) environment variable or provide apiKey in AiClientConfig.',
          );
        }
        return key;

      case 'deepseek':
        key = this.config.apiKey ?? process.env.DEEPSEEK_API_KEY;
        if (!key) {
          throw new Error(
            'Missing API key for provider "deepseek". Please set DEEPSEEK_API_KEY environment variable or provide apiKey in AiClientConfig.',
          );
        }
        return key;

      case 'ollama':
        // Ollama does not require an API key by default
        return this.config.apiKey ?? process.env.OLLAMA_API_KEY ?? '';
    }
  }

  async chat(options: ChatOptions): Promise<ChatResult> {
    // Validate options
    if (!options || !Array.isArray(options.messages) || options.messages.length === 0) {
      throw new Error('Invalid ChatOptions: "messages" must be a non-empty array of messages.');
    }

    const provider = this.resolveProvider();
    const model = this.resolveModel(provider, options.model);
    const maxSteps = options.maxSteps ?? this.config.maxSteps ?? this.config.maxAgentLoops ?? 1;
    const baseURL = this.config.baseURL;

    const start = Date.now();
    let result: ChatResult;

    switch (provider) {
      case 'anthropic': {
        const apiKey = this.resolveApiKey(provider);
        result = await anthropicChat(apiKey, model, options, this.tools, maxSteps, baseURL);
        break;
      }
      case 'openai': {
        const apiKey = this.resolveApiKey(provider);
        result = await openaiChat(apiKey, model, options, this.tools, maxSteps, baseURL);
        break;
      }
      case 'gemini': {
        const apiKey = this.resolveApiKey(provider);
        result = await geminiChat(apiKey, model, options, this.tools, maxSteps, baseURL);
        break;
      }
      case 'deepseek': {
        const apiKey = this.resolveApiKey(provider);
        result = await deepseekChat(apiKey, model, options, this.tools, maxSteps, baseURL);
        break;
      }
      case 'ollama': {
        const apiKey = this.resolveApiKey(provider);
        result = await ollamaChat(model, options, this.tools, maxSteps, baseURL, apiKey);
        break;
      }
      default: {
        const exhaustiveCheck: never = provider;
        throw new Error(`Unhandled provider: ${exhaustiveCheck}`);
      }
    }

    // Measure running time from start to end
    const durationMs = Date.now() - start;
    result.durationMs = durationMs;

    // Telemetry logging
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
        await this.config.telemetry.postgresPool
          .query(
            `INSERT INTO ai_usage_logs (provider, model, user_id, endpoint_context, prompt_tokens, completion_tokens, estimated_cost_usd, duration_ms)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              entry.provider,
              entry.model,
              entry.userId ?? null,
              entry.context ?? null,
              entry.promptTokens,
              entry.completionTokens,
              entry.estimatedCostUsd,
              entry.durationMs,
            ],
          )
          .catch((e: Error) => console.error('re-ai telemetry insert failed:', e.message));
      }
    }

    return result;
  }
}
