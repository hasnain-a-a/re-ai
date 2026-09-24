import { Module, Injectable, Inject, DynamicModule, Controller, Get, Query } from '@nestjs/common';
import { AiClient } from '../core/client.js';
import { getAiUsage, type AiUsageFilters, type UsageQueryPool } from '../core/usage.js';
import type { AiClientConfig, McpTool, ChatOptions, ChatResult } from '../core/types.js';

const RE_AI_CONFIG = 'RE_AI_CONFIG';
const RE_AI_USAGE_POOL = 'RE_AI_USAGE_POOL';

/** `GET /api/ai/usage` — backs the `AiUsagePage` from `@hasnain-a-a/re-ai/react`. */
@Controller('api/ai')
export class AiUsageController {
  constructor(@Inject(RE_AI_USAGE_POOL) private readonly pool: UsageQueryPool) {}

  @Get('usage')
  usage(@Query() filters: AiUsageFilters) {
    return getAiUsage(this.pool, filters);
  }
}

/**
 * Mounts the AI Usage API. `pool` is the host app's existing Postgres pool provider token
 * (the one `AiClient` telemetry writes `ai_usage_logs` into); its module must be global or imported.
 */
@Module({})
export class ReAiUsageModule {
  static forRoot({ pool }: { pool: string | symbol }): DynamicModule {
    return {
      module: ReAiUsageModule,
      controllers: [AiUsageController],
      providers: [{ provide: RE_AI_USAGE_POOL, useExisting: pool }],
    };
  }
}

@Injectable()
export class AiService {
  private client: AiClient;

  constructor(@Inject(RE_AI_CONFIG) config: AiClientConfig) {
    this.client = new AiClient(config);
  }

  registerTool(tool: McpTool): this {
    this.client.registerTool(tool);
    return this;
  }

  registerTools(tools: McpTool[]): this {
    this.client.registerTools(tools);
    return this;
  }

  chat(options: ChatOptions): Promise<ChatResult> {
    return this.client.chat(options);
  }
}

@Module({})
export class ReAiModule {
  static forRoot(config: AiClientConfig): DynamicModule {
    return {
      module: ReAiModule,
      providers: [
        { provide: RE_AI_CONFIG, useValue: config },
        AiService,
      ],
      exports: [AiService],
      global: true,
    };
  }
}
