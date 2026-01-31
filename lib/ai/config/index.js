/**
 * AI Configuration Index
 * ======================
 * Purpose: Central export point for all AI configuration.
 *
 * Exports:
 * - Agent configuration (temperature, timeouts, retry logic)
 * - Provider configuration (capabilities, fallback order, tiers)
 * - Utilities for accessing and validating config
 *
 * Usage:
 * import { getProviderRegistry, getProviderCapabilities, isProviderAllowedForTier } from 'lib/ai/config';
 */

export {
  getProviderRegistry,
  getFallbackProvider,
  isProviderAllowedForTier,
} from './providers.config.js';