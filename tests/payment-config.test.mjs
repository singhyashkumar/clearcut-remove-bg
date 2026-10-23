import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import config from '../vite.config.js';

test('payment API is permitted by CSP in production and local development', () => {
  const previous = process.env.VITE_PAYMENT_API_BASE_URL;
  process.env.VITE_PAYMENT_API_BASE_URL = 'https://clearcut-payments.clearcutt-payments.workers.dev';
  try {
    const plugin = config({ mode: 'production' }).plugins[0];
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    for (const server of [true, false]) {
      const output = plugin.transformIndexHtml(html, { server });
      assert.match(output, /connect-src 'self' https:\/\/clearcut-payments\.clearcutt-payments\.workers\.dev/);
      assert.match(output, /script-src[^;]+https:\/\/cdn\.razorpay\.com/);
      assert.doesNotMatch(output, /script-src[^;]+(?:'unsafe-eval'|https:\/\/\*)/);
    }
  } finally {
    if (previous === undefined) delete process.env.VITE_PAYMENT_API_BASE_URL;
    else process.env.VITE_PAYMENT_API_BASE_URL = previous;
  }
});
