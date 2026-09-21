/**
 * Vercel Speed Insights Integration
 * This module initializes Vercel Speed Insights for tracking web vitals and performance metrics.
 */

import { injectSpeedInsights } from './speed-insights-lib.mjs';

// Initialize Speed Insights with configuration
injectSpeedInsights({
  debug: false, // Set to true to enable debug logging in development
  // sampleRate: 1, // Track 100% of events (default)
  // beforeSend: (event) => {
  //   // Optional: Modify or filter events before sending
  //   return event;
  // }
});

console.log('✅ Vercel Speed Insights initialized');
