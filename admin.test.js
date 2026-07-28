const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.resolve(__dirname, 'admin.html'), 'utf8');

describe('sendMagicLink', () => {
  let dom;
  let document;
  let window;

  beforeEach(() => {
    // We only need the DOM elements required by the function
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <head></head>
        <body>
          <input id="login-email" value="" />
          <button id="magic-link-btn"></button>
          <div id="login-error" class="hidden"></div>
          <div id="magic-link-success" class="hidden"></div>
        </body>
      </html>
    `, { url: "http://localhost/admin.html", runScripts: "dangerously" });
    window = dom.window;
    document = window.document;

    // Mock sb.auth
    window.sb = {
      auth: {
        signInWithOtp: jest.fn()
      }
    };

    // Extract the function from admin.html
    // A bit hacky but works for inline scripts
    const scriptContent = html.match(/async function sendMagicLink\(\) \{[\s\S]*?\n      \}/)[0];

    // Define the function in the JSDOM window
    window.eval(scriptContent);
  });

  test('shows error if email is empty', async () => {
    document.getElementById('login-email').value = '';

    await window.sendMagicLink();

    const errorEl = document.getElementById('login-error');
    expect(errorEl.textContent).toBe('Please enter your email address first.');
    expect(errorEl.classList.contains('hidden')).toBe(false);
  });

  test('shows error if Supabase returns an error', async () => {
    document.getElementById('login-email').value = 'test@example.com';

    window.sb.auth.signInWithOtp.mockResolvedValueOnce({
      error: { message: 'Too many requests' }
    });

    await window.sendMagicLink();

    expect(window.sb.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      options: { emailRedirectTo: 'http://localhost/admin.html' }
    });

    const errorEl = document.getElementById('login-error');
    expect(errorEl.textContent).toBe('Too many requests');
    expect(errorEl.classList.contains('hidden')).toBe(false);

    const successEl = document.getElementById('magic-link-success');
    expect(successEl.classList.contains('hidden')).toBe(true);

    const btn = document.getElementById('magic-link-btn');
    expect(btn.disabled).toBe(false);
    expect(btn.innerHTML).toContain('Send Magic Link');
  });

  test('shows success if Supabase returns no error', async () => {
    document.getElementById('login-email').value = 'test@example.com';

    window.sb.auth.signInWithOtp.mockResolvedValueOnce({
      error: null
    });

    await window.sendMagicLink();

    const errorEl = document.getElementById('login-error');
    expect(errorEl.classList.contains('hidden')).toBe(true);

    const successEl = document.getElementById('magic-link-success');
    expect(successEl.classList.contains('hidden')).toBe(false);

    const btn = document.getElementById('magic-link-btn');
    expect(btn.disabled).toBe(false);
    expect(btn.innerHTML).toContain('Resend Magic Link');
  });
});
