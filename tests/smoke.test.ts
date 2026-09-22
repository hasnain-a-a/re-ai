import { describe, it, expect } from 'vitest';
import { AiClient, DEFAULT_MODELS, SUPPORTED_PROVIDERS, calculateCostUsd } from '../dist/index.js';

describe('Built Package Distribution Smoke Test', () => {
  it('exports all expected core utilities and classes from dist', () => {
    expect(AiClient).toBeDefined();
    expect(SUPPORTED_PROVIDERS).toEqual(['anthropic', 'openai', 'gemini', 'deepseek', 'ollama']);
    expect(DEFAULT_MODELS).toHaveProperty('anthropic');
    expect(DEFAULT_MODELS).toHaveProperty('openai');
    expect(DEFAULT_MODELS).toHaveProperty('gemini');
    expect(DEFAULT_MODELS).toHaveProperty('deepseek');
    expect(DEFAULT_MODELS).toHaveProperty('ollama');
  });

  it('calculates cost from dist bundle accurately', () => {
    expect(calculateCostUsd('ollama', 'llama3', 1000, 1000)).toBe(0);
    expect(calculateCostUsd('openai', 'gpt-4o', 1000, 1000)).toBeGreaterThan(0);
  });
});

