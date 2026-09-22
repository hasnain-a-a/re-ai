import { describe, it, expect } from 'vitest';
import { calculateCostUsd, MODEL_PRICING } from '../src/core/pricing.js';

describe('Pricing and Cost Calculation', () => {
  it('calculates Anthropic Claude 3.7 / 3.5 Sonnet pricing correctly', () => {
    // 1,000,000 input tokens = $3.00, 1,000,000 output tokens = $15.00
    const cost = calculateCostUsd('anthropic', 'claude-3-7-sonnet-20250219', 1_000_000, 1_000_000);
    expect(cost).toBe(18.0);

    const costSmall = calculateCostUsd('anthropic', 'claude-3-5-sonnet-latest', 1000, 1000);
    // (1000*3 + 1000*15) / 1,000,000 = 18000 / 1,000,000 = 0.018
    expect(costSmall).toBe(0.018);
  });

  it('calculates Anthropic Claude 3.5 Haiku pricing correctly', () => {
    // 1,000,000 input tokens = $0.80, 1,000,000 output tokens = $4.00
    const cost = calculateCostUsd('anthropic', 'claude-3-5-haiku-20241022', 1_000_000, 1_000_000);
    expect(cost).toBe(4.8);
  });

  it('calculates OpenAI GPT-4o and GPT-4o-mini pricing correctly', () => {
    // GPT-4o: $2.50 input, $10.00 output per 1M
    const gpt4oCost = calculateCostUsd('openai', 'gpt-4o', 1_000_000, 1_000_000);
    expect(gpt4oCost).toBe(12.5);

    // GPT-4o-mini: $0.15 input, $0.60 output per 1M
    const miniCost = calculateCostUsd('openai', 'gpt-4o-mini', 1_000_000, 1_000_000);
    expect(miniCost).toBe(0.75);
  });

  it('calculates OpenAI o3-mini pricing correctly', () => {
    // o3-mini: $1.10 input, $4.40 output per 1M
    const o3Cost = calculateCostUsd('openai', 'o3-mini', 1_000_000, 1_000_000);
    expect(o3Cost).toBe(5.5);
  });

  it('calculates Gemini 2.0 / 2.5 Flash pricing correctly', () => {
    // Gemini Flash: $0.10 input, $0.40 output per 1M
    const flashCost = calculateCostUsd('gemini', 'gemini-2.0-flash', 1_000_000, 1_000_000);
    expect(flashCost).toBe(0.5);

    // Gemini Flash-Lite: $0.075 input, $0.30 output per 1M
    const liteCost = calculateCostUsd('gemini', 'gemini-2.5-flash-lite', 1_000_000, 1_000_000);
    expect(liteCost).toBe(0.375);
  });

  it('calculates Gemini Pro pricing correctly', () => {
    // Gemini 2.5 Pro: $1.25 input, $5.00 output per 1M
    const proCost = calculateCostUsd('gemini', 'gemini-2.5-pro', 1_000_000, 1_000_000);
    expect(proCost).toBe(6.25);
  });

  it('calculates DeepSeek V3 and R1 pricing correctly', () => {
    // deepseek-chat: $0.27 input, $1.10 output per 1M
    const chatCost = calculateCostUsd('deepseek', 'deepseek-chat', 1_000_000, 1_000_000);
    expect(chatCost).toBe(1.37);

    // deepseek-reasoner: $0.55 input, $2.19 output per 1M
    const reasonerCost = calculateCostUsd('deepseek', 'deepseek-reasoner', 1_000_000, 1_000_000);
    expect(reasonerCost).toBe(2.74);
  });

  it('strictly returns $0.00 for Ollama regardless of token counts', () => {
    expect(calculateCostUsd('ollama', 'llama3', 100_000, 50_000)).toBe(0);
    expect(calculateCostUsd('ollama', 'llama3.2', 10_000_000, 10_000_000)).toBe(0);
    expect(calculateCostUsd('ollama', 'mistral', 500, 250)).toBe(0);
  });

  it('falls back to default provider pricing for unknown models', () => {
    const unknownCost = calculateCostUsd('openai', 'custom-finetuned-model', 1_000_000, 1_000_000);
    const defaultPricing = MODEL_PRICING.openai.default;
    expect(unknownCost).toBe(defaultPricing.input + defaultPricing.output);
  });
});

