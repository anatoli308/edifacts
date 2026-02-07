/**
 * AI Configuration Index
 * ======================
 * Purpose: Central export point for all AI configuration.
 *
 * Exports:
 * - Provider configuration (capabilities, fallback order)
 * - Utilities for accessing and validating config
 *
 * Usage:
 * import { getProviderRegistry, getFallbackProvider } from 'lib/ai/config';
 */

export {
  getProviderRegistry,
  getFallbackProvider,
} from './providers.config.js';