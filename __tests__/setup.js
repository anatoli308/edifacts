/**
 * Test Setup & Configuration
 * ==========================
 * Purpose: Common setup for all tests (mocks, fixtures, helpers).
 *
 * Responsibilities:
 * - Mock LLM providers
 * - Mock database connections
 * - Setup test fixtures
 * - Configure test environment
 * - Setup global test utilities
 *
 * Usage:
 * This file is automatically run before tests via vitest.config.js
 * setupFiles: ['__tests__/setup.js']
 */

import { vi } from 'vitest';

/**
 * Mock MongoDB/Mongoose
 */
global.mockDB = {
  connect: vi.fn().mockResolvedValue(true),
  disconnect: vi.fn().mockResolvedValue(true),
  findOne: vi.fn(),
  findById: vi.fn(),
  save: vi.fn().mockResolvedValue(true)
};

/**
 * Mock LLM Provider
 */
global.mockProvider = {
  callLLM: vi.fn().mockResolvedValue(JSON.stringify({
    content: 'Mock response',
    choices: [{ message: { content: 'Mock response' } }]
  })),
  getName: vi.fn().mockReturnValue('mock-provider'),
  supportsParallelTools: vi.fn().mockReturnValue(true)
};

/**
 * Mock OpenAI Provider
 */
global.mockOpenAIProvider = {
  callLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: 'Mock OpenAI response',
        tool_calls: []
      }
    }],
    usage: { prompt_tokens: 10, completion_tokens: 20 }
  }),
  getName: vi.fn().mockReturnValue('openai'),
  supportsParallelTools: vi.fn().mockReturnValue(true)
};

/**
 * Mock Anthropic Provider
 */
global.mockAnthropicProvider = {
  callLLM: vi.fn().mockResolvedValue({
    content: [{
      type: 'text',
      text: 'Mock Anthropic response'
    }],
    usage: { input_tokens: 10, output_tokens: 20 }
  }),
  getName: vi.fn().mockReturnValue('anthropic'),
  supportsParallelTools: vi.fn().mockReturnValue(false) // Sequential only
};

/**
 * Mock Tool Registry
 */
global.mockToolRegistry = {
  has: vi.fn().mockReturnValue(true),
  getTool: vi.fn().mockReturnValue({
    name: 'mockTool',
    description: 'A mock tool',
    inputSchema: { type: 'object' },
    execute: vi.fn().mockResolvedValue({ result: 'success' })
  }),
  listTools: vi.fn().mockReturnValue([
    { name: 'tool1', category: 'analysis' },
    { name: 'tool2', category: 'validation' }
  ]),
  getSchema: vi.fn().mockReturnValue({ type: 'object' }),
  validate: vi.fn().mockReturnValue(true)
};

/**
 * Mock EDIFACT Fixtures
 */
global.fixtures = {
  validEDIFACT: `UNB+UNOC:3+SENDER+RECEIVER+060101:1201+++++TEST'UNH+123+INVOIC:D:96A:UN'BGM+380+INV001+9'DTM+137:20240101:102'`,
  
  invalidEDIFACT: `UNB+UNOC:3+SENDER+RECEIVER'BGM+380+INV001`,
  
  validInvoice: {
    messageType: 'INVOIC',
    segments: ['UNB', 'UNH', 'BGM', 'DTM', 'NAD', 'LIN', 'UNT', 'UNZ'],
    valid: true
  },
  
  invalidInvoice: {
    messageType: 'INVOIC',
    segments: ['UNB', 'BGM'], // Missing UNH
    valid: false
  }
};

/**
 * Mock Agent Context
 */
global.mockAgentContext = {
  module: 'edifact',
  sessionId: 'test-session-123',
  analysisId: 'test-analysis-456',
  userId: 'test-user-789',
  provider: global.mockProvider,
  toolRegistry: global.mockToolRegistry
};

/**
 * Suppress console errors in tests (optional)
 */
const originalError = console.error;
beforeAll(() => {
  // Uncomment to suppress specific errors:
  // console.error = (...args) => {
  //   if (typeof args[0] === 'string' && args[0].includes('act(...)')) return;
  //   originalError.call(console, ...args);
  // };
});

afterAll(() => {
  console.error = originalError;
});

/**
 * Helper: Create mock tool
 */
global.createMockTool = (overrides = {}) => ({
  name: 'mockTool',
  description: 'A mock tool for testing',
  inputSchema: { type: 'object', properties: {} },
  execute: vi.fn().mockResolvedValue({ result: 'success' }),
  ...overrides
});

/**
 * Helper: Create mock agent response
 */
global.createMockAgentResponse = (overrides = {}) => ({
  success: true,
  agentName: 'mock-agent',
  result: { content: 'Mock response' },
  duration_ms: 100,
  ...overrides
});

/**
 * Helper: Create mock tool call
 */
global.createMockToolCall = (overrides = {}) => ({
  tool: 'mockTool',
  arguments: { arg1: 'value1' },
  timestamp: new Date().toISOString(),
  ...overrides
});
