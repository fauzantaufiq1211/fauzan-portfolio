const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const html = fs.readFileSync(path.resolve(__dirname, '../admin.html'), 'utf8');

describe('getLocalReadIds', () => {
  let dom;
  let window;

  beforeEach(() => {
    const virtualConsole = new VirtualConsole();
    // Silence console errors from missing globals in the script
    virtualConsole.on("error", () => {});
    virtualConsole.on("warn", () => {});
    virtualConsole.on("info", () => {});
    virtualConsole.on("dir", () => {});

    dom = new JSDOM(html, {
      url: "http://localhost",
      runScripts: "dangerously",
      virtualConsole,
      beforeParse(window) {
        // mock to prevent script execution issues
        window.tailwind = { config: {} };
        window.supabase = {
          createClient: jest.fn().mockReturnValue({
            auth: {
              onAuthStateChange: jest.fn(),
              getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null })
            },
            from: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          })
        };
      }
    });
    window = dom.window;
  });

  afterEach(() => {
    window.localStorage.clear();
    // Cleanup jsdom to prevent memory leaks or open handles
    if (dom) {
      dom.window.close();
    }
  });

  test('should return empty array when localStorage is empty', () => {
    window.localStorage.removeItem('inbox-read-ids');
    const ids = window.getLocalReadIds();
    expect(ids).toEqual([]);
  });

  test('should return parsed array when localStorage has valid JSON array', () => {
    window.localStorage.setItem('inbox-read-ids', JSON.stringify([1, 2, 3]));
    const ids = window.getLocalReadIds();
    expect(ids).toEqual([1, 2, 3]);
  });

  test('should return empty array when localStorage has invalid JSON', () => {
    window.localStorage.setItem('inbox-read-ids', 'invalid-json');
    const ids = window.getLocalReadIds();
    expect(ids).toEqual([]);
  });
});
