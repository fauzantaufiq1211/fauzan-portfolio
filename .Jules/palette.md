## 2024-07-04 - Adding Aria Labels to Icon-only Buttons
**Learning:** Found multiple instances across the application (index.html and admin.html) where icon-only buttons (like close buttons, mobile menu toggles, and carousel navigation) lacked `aria-label` attributes, making them inaccessible to screen readers.
**Action:** Always verify that every `<button>` element containing only an `<svg>` or icon font has a descriptive `aria-label` attribute indicating its purpose or action.
