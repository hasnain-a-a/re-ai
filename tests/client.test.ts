import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AiClient, DEFAULT_MODELS } from '../src/core/client.js';

describe('AiClient Configuration and Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Clear relevant env vars
    delete process.env.AI_PROVIDER;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OLLAMA_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.OPENAI_MODEL;
    delete process.env.GEMINI_MODEL;
    delete process.env.DEEPSEEK_MODEL;
    delete process.env.OLLAMA_MODEL;
    delete process.env.DEFAULT_MODEL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Provider Resolution & Validation', () => {
    it('defaults provider to anthropic when not configured', () => {
      const client = new AiClient();
      expect(client.resolveProvider()).toBe('anthropic');
    });

    it('resolves provider from config', () => {
      const client = new AiClient({ provider: 'openai' });
      expect(client.resolveProvider()).toBe('openai');
    });

    it('resolves provider from AI_PROVIDER environment variable', () => {
      process.env.AI_PROVIDER = 'deepseek';
      const client = new AiClient();
      expect(client.resolveProvider()).toBe('deepseek');
    });

    it('throws when an unsupported provider is specified', () => {
      const client = new AiClient({ provider: 'cohere' as any });
      expect(() => client.resolveProvider()).toThrowError(/Unsupported provider "cohere"/);
    });
  });

  describe('Model Resolution', () => {
    it('uses built-in default model for each provider when no overrides are given', () => {
      const client = new AiClient();
      expect(client.resolveModel('anthropic')).toBe(DEFAULT_MODELS.anthropic);
      expect(client.resolveModel('openai')).toBe(DEFAULT_MODELS.openai);
      expect(client.resolveModel('gemini')).toBe(DEFAULT_MODELS.gemini);
      expect(client.resolveModel('deepseek')).toBe(DEFAULT_MODELS.deepseek);
      expect(client.resolveModel('ollama')).toBe(DEFAULT_MODELS.ollama);
    });

    it('loads model name from provider-specific env variable', () => {
      process.env.ANTHROPIC_MODEL = 'claude-3-5-haiku-20241022';
      process.env.OPENAI_MODEL = 'gpt-4o-mini';
      process.env.GEMINI_MODEL = 'gemini-2.5-pro';
      process.env.DEEPSEEK_MODEL = 'deepseek-reasoner';
      process.env.OLLAMA_MODEL = 'mistral';

      const client = new AiClient();
      expect(client.resolveModel('anthropic')).toBe('claude-3-5-haiku-20241022');
      expect(client.resolveModel('openai')).toBe('gpt-4o-mini');
      expect(client.resolveModel('gemini')).toBe('gemini-2.5-pro');
      expect(client.resolveModel('deepseek')).toBe('deepseek-reasoner');
      expect(client.resolveModel('ollama')).toBe('mistral');
    });

    it('loads model name from general DEFAULT_MODEL env var if provider-specific is unset', () => {
      process.env.DEFAULT_MODEL = 'custom-global-model';
      const client = new AiClient();
      expect(client.resolveModel('openai')).toBe('custom-global-model');
    });

    it('prefers config.model over environment variables', () => {
      process.env.OPENAI_MODEL = 'env-model';
      const client = new AiClient({ model: 'config-model' });
      expect(client.resolveModel('openai')).toBe('config-model');
    });

    it('prefers options.model over config and environment variables', () => {
      process.env.OPENAI_MODEL = 'env-model';
      const client = new AiClient({ model: 'config-model' });
      expect(client.resolveModel('openai', 'options-model')).toBe('options-model');
    });
  });

  describe('API Key and Options Validation', () => {
    it('throws error when options.messages is empty or invalid', async () => {
      const client = new AiClient();
      await expect(client.chat({ messages: [] })).rejects.toThrowError(
        'Invalid ChatOptions: "messages" must be a non-empty array of messages.',
      );
      await expect(client.chat({} as any)).rejects.toThrowError(
        'Invalid ChatOptions: "messages" must be a non-empty array of messages.',
      );
    });

    it('throws clear error when ANTHROPIC_API_KEY is missing', async () => {
      const client = new AiClient({ provider: 'anthropic' });
      await expect(
        client.chat({ messages: [{ role: 'user', content: 'hello' }] }),
      ).rejects.toThrowError(/Missing API key for provider "anthropic"/);
    });

    it('throws clear error when OPENAI_API_KEY is missing', async () => {
      const client = new AiClient({ provider: 'openai' });
      await expect(
        client.chat({ messages: [{ role: 'user', content: 'hello' }] }),
      ).rejects.toThrowError(/Missing API key for provider "openai"/);
    });

    it('throws clear error when GEMINI_API_KEY / GOOGLE_API_KEY is missing', async () => {
      const client = new AiClient({ provider: 'gemini' });
      await expect(
        client.chat({ messages: [{ role: 'user', content: 'hello' }] }),
      ).rejects.toThrowError(/Missing API key for provider "gemini"/);
    });

    it('throws clear error when DEEPSEEK_API_KEY is missing', async () => {
      const client = new AiClient({ provider: 'deepseek' });
      await expect(
        client.chat({ messages: [{ role: 'user', content: 'hello' }] }),
      ).rejects.toThrowError(/Missing API key for provider "deepseek"/);
    });
  });

  describe('maxSteps Configuration', () => {
    it('defaults maxSteps to 1', () => {
      const client = new AiClient();
      expect((client as any).config.maxSteps).toBe(1);
    });

    it('respects maxSteps in config', () => {
      const client = new AiClient({ maxSteps: 5 });
      expect((client as any).config.maxSteps).toBe(5);
    });

    it('respects legacy maxAgentLoops in config as alias', () => {
      const client = new AiClient({ maxAgentLoops: 8 });
      expect((client as any).config.maxSteps).toBe(8);
    });
  });

  describe('Chat Execution & Duration Tracking', () => {
    it('measures start-to-end durationMs and logs usage telemetry', async () => {
      const ollamaModule = await import('../src/providers/ollama.js');
      const spy = vi.spyOn(ollamaModule, 'ollamaChat').mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 15));
        return {
          content: 'local answer',
          usage: { inputTokens: 50, outputTokens: 25, totalTokens: 75, estimatedCostUsd: 0 },
          toolCallsExecuted: 0,
          durationMs: 0,
        };
      });

      const loggedEntries: any[] = [];
      const client = new AiClient({
        provider: 'ollama',
        telemetry: {
          log: (entry) => loggedEntries.push(entry),
        },
      });

      const res = await client.chat({
        messages: [{ role: 'user', content: 'hello from test' }],
        context: 'test-suite',
      });

      expect(res.content).toBe('local answer');
      expect(res.durationMs).toBeGreaterThanOrEqual(10);
      expect(res.usage.estimatedCostUsd).toBe(0);
      expect(res.usage.totalTokens).toBe(75);

      expect(loggedEntries).toHaveLength(1);
      expect(loggedEntries[0].provider).toBe('ollama');
      expect(loggedEntries[0].estimatedCostUsd).toBe(0);
      expect(loggedEntries[0].durationMs).toBeGreaterThanOrEqual(10);

      spy.mockRestore();
    });
  });
});

