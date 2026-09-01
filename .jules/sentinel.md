## 2026-09-01 - [Incomplete Escaping in HTML Templates]
**Vulnerability:** XSS vulnerability due to incomplete HTML escaping implementation that left quote marks unescaped, allowing breakout from attribute contexts.
**Learning:** The custom `esc()` function originally relied on assigning to `textContent` and reading `innerHTML`. While this escapes `<`, `>`, and `&`, it fails to escape single and double quotes, which are critical when the escaped string is placed inside HTML attributes.
**Prevention:** Always use a robust string replacement approach for HTML escaping that explicitly includes `&`, `<`, `>`, `"`, and `'` when developing custom escaping logic for vanilla JS templates.
