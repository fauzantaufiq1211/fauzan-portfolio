import { expect, test } from "vitest";
import fs from "fs";
import path from "path";

// Read HTML content
const htmlPath = path.join(__dirname, "admin.html");
const htmlContent = fs.readFileSync(htmlPath, "utf-8");

// Extract esc function logic
const escMatch = htmlContent.match(/function esc\(str\) \{([\s\S]*?)\}/);
if (!escMatch) {
  throw new Error("Could not find esc function in admin.html");
}

// Evaluate esc function inside a virtual environment context
// using a mock document since it's embedded HTML JS running in vitest's node env
const mockDocument = {
  createElement: () => ({
    get textContent() {
      return this._text || "";
    },
    set textContent(val) {
      this._text = val;
      // simple mock implementation of browser behavior where textContent escapes HTML
      this.innerHTML = val
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    },
    innerHTML: "",
  }),
};

// Create a function using the extracted body
const escFn = new Function(
  "str",
  "document",
  `
  ${escMatch[0]}
  return esc(str);
`,
);

test("esc function properly escapes HTML tags and quotes", () => {
  const result = escFn("<div class=\"test\" id='x'>&</div>", mockDocument);
  expect(result).toBe(
    "&lt;div class=&quot;test&quot; id=&#39;x&#39;&gt;&amp;&lt;/div&gt;",
  );
});

test("esc function handles null or undefined", () => {
  expect(escFn(null, mockDocument)).toBe("");
  expect(escFn(undefined, mockDocument)).toBe("");
});

test("esc function handles standard strings", () => {
  expect(escFn("hello world", mockDocument)).toBe("hello world");
});
