import { Module, Injectable, Inject, DynamicModule } from '@nestjs/common';
import { AiClient } from '../core/client.js';
import type { AiClientConfig, McpTool, ChatOptions, ChatResult } from '../core/types.js';

const RE_AI_CONFIG = 'RE_AI_CONFIG';

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
