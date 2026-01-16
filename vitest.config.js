import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test Environment
    environment: 'happy-dom', // Use happy-dom for DOM testing (lightweight)
    globals: true, // Makes describe, it, expect global (no need to import)
    
    // Files and Patterns
    include: ['__tests__/**/*.test.js', '__tests__/**/*.spec.js'],
    exclude: ['node_modules', '.next', 'dist'],
    
    // Setup
    setupFiles: ['__tests__/setup.js'],
    
    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        '__tests__/',
        '.next/',
        'dist/',
        '**/*.config.js',
        '**/index.js' // exclude barrel exports
      ],
      all: false // Only report on files with tests
    },
    
    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // Reporters
    reporters: ['default'],
    
    // Watch Mode
    watch: false,
    
    // Snapshots
    snapshotFormat: {
      printBasicPrototype: false
    },
    
    // Paths Aliases (match jsconfig.json)
    alias: {
      '@/app': path.resolve('./app'),
      '@/lib': path.resolve('./lib'),
      '@/models': path.resolve('./models'),
      '@/_modules': path.resolve('./_modules'),
      '@/_workers': path.resolve('./_workers')
    }
  },
  
  // Resolve for imports
  resolve: {
    alias: {
      '@/app': path.resolve('./app'),
      '@/lib': path.resolve('./lib'),
      '@/models': path.resolve('./models'),
      '@/_modules': path.resolve('./_modules'),
      '@/_workers': path.resolve('./_workers')
    }
  }
});
