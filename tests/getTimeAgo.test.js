import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import fs from 'fs';

let getTimeAgo;

describe('getTimeAgo', () => {
  beforeAll(() => {
    // Read the HTML file
    const html = fs.readFileSync('admin.html', 'utf-8');

    // We want to test the EXACT function from the codebase.
    // So we extract it via regex. This ensures we are testing the actual code in admin.html
    const match = html.match(/function getTimeAgo\s*\([^)]*\)\s*{[\s\S]*?return new Date\(dateStr\)\.toLocaleDateString\("en-US", {[\s\S]*?day: "numeric",\s*}\);\s*}/);

    if (match) {
      // By using Function constructor and string interpolation, we evaluate the function in the current global context
      // This means when the function calls `new Date()`, it uses Vitest's mocked Date!
      getTimeAgo = new Function('return ' + match[0])();
    } else {
      throw new Error("Could not extract getTimeAgo from admin.html");
    }
  });

  const MOCK_DATE = new Date('2024-03-15T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Edge cases for missing/invalid input
  it('returns empty string if no date provided or invalid falsy value', () => {
    expect(getTimeAgo()).toBe('');
    expect(getTimeAgo(null)).toBe('');
    expect(getTimeAgo(undefined)).toBe('');
    expect(getTimeAgo('')).toBe('');
  });

  // Edge cases for exact boundaries
  it('returns "Just now" for dates less than 60 seconds ago', () => {
    const date = new Date(MOCK_DATE.getTime() - 59 * 1000); // 59s
    expect(getTimeAgo(date.toISOString())).toBe('Just now');
  });

  it('handles the exact 60 seconds boundary (1m ago)', () => {
    const date = new Date(MOCK_DATE.getTime() - 60 * 1000); // exactly 60s
    expect(getTimeAgo(date.toISOString())).toBe('1m ago');
  });

  it('handles the exact 1 hour boundary (1h ago)', () => {
    const date = new Date(MOCK_DATE.getTime() - 3600 * 1000); // exactly 1h
    expect(getTimeAgo(date.toISOString())).toBe('1h ago');
  });

  it('handles the exact 1 day boundary (1d ago)', () => {
    const date = new Date(MOCK_DATE.getTime() - 86400 * 1000); // exactly 1d
    expect(getTimeAgo(date.toISOString())).toBe('1d ago');
  });

  it('handles the exact 7 days boundary (formats as date)', () => {
    const date = new Date(MOCK_DATE.getTime() - 604800 * 1000); // exactly 7d
    const result = getTimeAgo(date.toISOString());
    // MOCK_DATE is Mar 15, 7 days ago is Mar 8
    expect(result).toMatch(/Mar 8/);
  });

  // General functionality
  it('returns minutes ago for dates between 1 and 59 minutes ago', () => {
    const date = new Date(MOCK_DATE.getTime() - 5 * 60 * 1000);
    expect(getTimeAgo(date.toISOString())).toBe('5m ago');

    const date2 = new Date(MOCK_DATE.getTime() - 59 * 60 * 1000);
    expect(getTimeAgo(date2.toISOString())).toBe('59m ago');
  });

  it('returns hours ago for dates between 1 and 23 hours ago', () => {
    const date = new Date(MOCK_DATE.getTime() - 2 * 60 * 60 * 1000);
    expect(getTimeAgo(date.toISOString())).toBe('2h ago');

    const date2 = new Date(MOCK_DATE.getTime() - 23 * 60 * 60 * 1000);
    expect(getTimeAgo(date2.toISOString())).toBe('23h ago');
  });

  it('returns days ago for dates between 1 and 6 days ago', () => {
    const date = new Date(MOCK_DATE.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(getTimeAgo(date.toISOString())).toBe('3d ago');

    const date2 = new Date(MOCK_DATE.getTime() - 6 * 24 * 60 * 60 * 1000);
    expect(getTimeAgo(date2.toISOString())).toBe('6d ago');
  });

  // Future dates (negative difference)
  it('handles future dates by falling through to "Just now"', () => {
    // 1 hour in the future
    const futureDate = new Date(MOCK_DATE.getTime() + 3600 * 1000);
    expect(getTimeAgo(futureDate.toISOString())).toBe('Just now');
  });

  it('handles invalid date strings gracefully', () => {
    const invalidDateStr = 'not-a-date';
    try {
      expect(getTimeAgo(invalidDateStr)).toBe('Invalid Date'); // toLocaleDateString of invalid date
    } catch (e) {
      expect(e).toBeInstanceOf(RangeError);
    }
  });
});
