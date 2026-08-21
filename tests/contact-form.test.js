const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

describe('Contact Form Phone Input Edge Cases', () => {
  let dom;
  let phoneInput;

  beforeEach(() => {
    // Read the actual index.html file
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');

    // We only care about the contact form logic, so let's extract that portion of the DOM
    dom = new JSDOM(`
      <html>
        <body>
          <form id="contact-form">
            <input type="text" id="phone" value="" />
            <button type="submit">Submit</button>
          </form>
        </body>
      </html>
    `, {
      runScripts: 'dangerously'
    });

    // Instead of evaluating the whole script using script elements which can fail if global objects are missing,
    // let's extract the actual initContactForm body and execute it directly in the node context where we
    // have control over `document` and `window` and bypass any syntax or global errors.

    const initFnMatch = html.match(/function initContactForm\(\) \{([\s\S]*?)\n\s*\}\n\s*\/\/ KEYBOARD/);
    if (initFnMatch && initFnMatch[1]) {
        // We create a function and execute it against our JSDOM document
        const initContactForm = new Function('document', 'window', initFnMatch[1]);
        initContactForm(dom.window.document, dom.window);
    }

    phoneInput = dom.window.document.getElementById('phone');
  });

  afterEach(() => {
    // Cleanup
    if (dom && dom.window) {
        dom.window.close();
    }
  });

  test('should append + at the beginning if typing numbers', () => {
    phoneInput.value = '812345';
    phoneInput.dispatchEvent(new dom.window.Event('input'));
    expect(phoneInput.value).toBe('+812345');
  });

  test('should strip non-numeric characters', () => {
    phoneInput.value = '+812abcd345';
    phoneInput.dispatchEvent(new dom.window.Event('input'));
    expect(phoneInput.value).toBe('+812345');
  });

  test('should remove intermediate + signs', () => {
    phoneInput.value = '+812+345+678';
    phoneInput.dispatchEvent(new dom.window.Event('input'));
    expect(phoneInput.value).toBe('+812345678');
  });

  test('should handle completely non-numeric strings by becoming empty', () => {
    phoneInput.value = 'hello';
    phoneInput.dispatchEvent(new dom.window.Event('input'));
    expect(phoneInput.value).toBe('');
  });

  test('should allow clearing the input', () => {
    phoneInput.value = '';
    phoneInput.dispatchEvent(new dom.window.Event('input'));
    expect(phoneInput.value).toBe('');
  });

  test('should keep existing + prefix', () => {
    phoneInput.value = '+62812';
    phoneInput.dispatchEvent(new dom.window.Event('input'));
    expect(phoneInput.value).toBe('+62812');
  });

  test('should set value to +62 when focused and empty', () => {
    phoneInput.dispatchEvent(new dom.window.Event('focus'));
    expect(phoneInput.value).toBe('+62');
  });

  test('should clear value when blurred and value is exactly +62', () => {
    phoneInput.value = '+62';
    phoneInput.dispatchEvent(new dom.window.Event('blur'));
    expect(phoneInput.value).toBe('');
  });

  test('should clear value when blurred and value is exactly +', () => {
    phoneInput.value = '+';
    phoneInput.dispatchEvent(new dom.window.Event('blur'));
    expect(phoneInput.value).toBe('');
  });

  test('should NOT clear value when blurred and value is not exactly +62 or +', () => {
    phoneInput.value = '+628123';
    phoneInput.dispatchEvent(new dom.window.Event('blur'));
    expect(phoneInput.value).toBe('+628123');
  });
});
