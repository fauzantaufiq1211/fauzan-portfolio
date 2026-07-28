const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('admin.html initAuth', () => {
  let dom;
  let window;
  let getSessionMock;
  let showDashboardMock;

  beforeEach(() => {
    const html = fs.readFileSync(path.resolve(__dirname, 'admin.html'), 'utf8');

    getSessionMock = jest.fn().mockResolvedValue({ data: { session: null } }); // default mock
    showDashboardMock = jest.fn();

    // Setup a clean virtual console to prevent jsdom from polluting test output
    const virtualConsole = new (require('jsdom').VirtualConsole)();
    virtualConsole.sendTo(console, { omitJSDOMErrors: true });

    dom = new JSDOM(html, {
      url: "http://localhost",
      runScripts: 'dangerously',
      virtualConsole,
      beforeParse(win) {
        // Mock Supabase
        win.supabase = {
          createClient: () => ({
            auth: {
              getSession: getSessionMock,
              onAuthStateChange: jest.fn(),
            }
          })
        };

        // Mock matchMedia for UI scripts
        win.matchMedia = jest.fn().mockImplementation(query => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        }));
      }
    });
    window = dom.window;

    // We override showDashboard with our mock
    window.showDashboard = showDashboardMock;
  });

  afterEach(() => {
    if (window) {
      window.close();
    }
  });

  test('calls showDashboard when session exists', async () => {
    const mockUser = { id: 1, email: 'test@example.com' };

    // override the default mock for this test
    getSessionMock.mockResolvedValueOnce({ data: { session: { user: mockUser } } });

    // wait for async inline scripts to finish initializing
    await new Promise(resolve => setTimeout(resolve, 50));

    // Call initAuth
    await window.initAuth();

    expect(getSessionMock).toHaveBeenCalled();
    expect(showDashboardMock).toHaveBeenCalledWith(mockUser);
  });

  test('does not call showDashboard when no session exists', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } });

    await new Promise(resolve => setTimeout(resolve, 50));

    await window.initAuth();

    expect(getSessionMock).toHaveBeenCalled();
    expect(showDashboardMock).not.toHaveBeenCalled();
  });
});
