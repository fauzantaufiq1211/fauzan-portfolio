import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Read admin.html
const htmlContent = fs.readFileSync(path.resolve(__dirname, 'admin.html'), 'utf-8');

describe('checkIsReadColumn', () => {
  beforeAll(() => {
    // Reset DOM
    document.body.innerHTML = '';

    const checkIsReadColumnRegex = /let\s+hasIsReadColumn\s*=\s*null;[\s\S]*?async\s+function\s+checkIsReadColumn\(\)\s*\{[\s\S]*?return\s+hasIsReadColumn;\s*\}/;
    const match = htmlContent.match(checkIsReadColumnRegex);

    if (!match) {
      throw new Error('Could not extract checkIsReadColumn from admin.html');
    }

    // Evaluate the code ONCE in the JSDOM context using eval.
    // We bind the extracted code globally inside an IIFE to avoid any re-declaration issues
    // if run multiple times, although beforeAll already mitigates that.
    window.eval(`
      (() => {
        ${match[0]}
        window._testCheckIsReadColumn = checkIsReadColumn;

        // Expose a way to reset the internal state variable for testing isolation
        window._resetHasIsReadColumn = function() {
           hasIsReadColumn = null;
        };
      })();

      window._testSetSb = function(mockSb) {
         window.sb = mockSb;
      };
    `);
  });

  afterEach(() => {
    // Reset the internal memoization state after each test
    window._resetHasIsReadColumn();
  });

  it('should return false when Supabase query throws an error', async () => {
    window._testSetSb({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(() => {
        throw new Error('Supabase error');
      }),
    });

    const result = await window._testCheckIsReadColumn();
    expect(result).toBe(false);
  });

  it('should return true when Supabase query succeeds without error', async () => {
    window._testSetSb({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await window._testCheckIsReadColumn();
    expect(result).toBe(true);
  });

  it('should return false when Supabase query returns an error object', async () => {
    window._testSetSb({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ error: { message: "Column not found" } }),
    });

    const result = await window._testCheckIsReadColumn();
    expect(result).toBe(false);
  });
});
