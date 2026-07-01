import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('fetchCompetencies', () => {
  beforeEach(() => {
    const html = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf8');
    document.documentElement.innerHTML = html;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle error gracefully and log to console', async () => {
    // Read the HTML file and extract the script content to evaluate it
    const html = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf8');

    // We need to provide the expected DOM elements
    document.body.innerHTML = `
      <div id="competencies-arsenal-container"></div>
      <div id="competencies-other-container"></div>
    `;

    // Create a mock for Supabase
    window.supabaseClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: new Error("Test Supabase error")
      })
    };

    // Extract fetchCompetencies function from HTML
    const fetchCompetenciesRegex = /async function fetchCompetencies\(\) \{[\s\S]*?console\.error\("Error loading competencies:", err\);\n\s*\}\n\s*\}/;
    const match = html.match(fetchCompetenciesRegex);

    if (match) {
      // Evaluate the function and bind to window so we can call it
      eval(`window.fetchCompetencies = ${match[0]}`);

      // Call it
      await window.fetchCompetencies();

      // Verify console.error was called
      expect(console.error).toHaveBeenCalledWith(
        "Error loading competencies:",
        expect.any(Error)
      );
      expect(console.error.mock.calls[0][1].message).toBe("Test Supabase error");
    } else {
      throw new Error("Could not find fetchCompetencies function in index.html");
    }
  });
});
