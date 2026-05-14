# Inquiry Form (Poptávka) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Poptávka" nav button to plotys.html that opens a modal form emailing an inquiry to the owner via FormSubmit.

**Architecture:** Nav button triggers a modal reusing the existing `.modal` pattern. Three JS functions handle open/close/submit. Styles added to styles.css. No new files created.

**Tech Stack:** Vanilla HTML/CSS/JS, FormSubmit (existing), localStorage for notify email (existing pattern).

---

## File Map

| File | Change |
|---|---|
| `styles.css` | Add nav button styles + fence type pill checkbox styles |
| `plotys.html` | Add `<li>` nav button + full `inquiryModal` HTML |
| `script.js` | Add `openInquiryModal`, `closeInquiryModal`, `submitInquiry` |

---

### Task 1: Add CSS — nav button and fence type pill checkboxes

**Files:**
- Modify: `styles.css` (append before closing line / after the `/* ===== TOAST =====` block)

> Note: No test runner in this project — verification is manual in-browser. Each task ends with an open-in-browser check.

- [ ] **Step 1: Add styles to styles.css**

Append the following block at the end of `styles.css`, just before the final `@media (max-width:480px)` block (or at the very end of the file):

```css
/* ===== NAV INQUIRY BUTTON ===== */
nav a.nav-inquiry{
  border:1.5px solid var(--accent);
  color:var(--accent);
  padding:10px 22px;
  border-radius:50px;
  margin-left:8px;
  background:transparent;
}
nav a.nav-inquiry:hover{background:var(--accent);color:#fff;border-color:var(--accent)}
nav a.nav-inquiry::after{display:none}
.page-home header:not(.scrolled) nav a.nav-inquiry{
  border-color:rgba(255,255,255,0.5) !important;
  color:#fff !important;
}
.page-home header:not(.scrolled) nav a.nav-inquiry:hover{
  background:rgba(255,255,255,0.15) !important;
  border-color:rgba(255,255,255,0.5) !important;
}

/* ===== FENCE TYPE PILL CHECKBOXES ===== */
.inquiry-field-label{
  font-size:11px;font-weight:700;
  color:var(--gray-500);
  text-transform:uppercase;letter-spacing:2px;
  margin-bottom:10px;
}
.inquiry-field-label span{
  color:var(--gray-400);font-weight:400;
  text-transform:none;letter-spacing:0;font-size:11px;
}
.fence-type-options{display:flex;flex-wrap:wrap;gap:8px}
.fence-type-options label{
  display:flex;align-items:center;gap:6px;
  padding:8px 14px;
  border:1.5px solid var(--gray-200);
  border-radius:50px;
  font-size:13px;font-weight:500;
  cursor:pointer;
  transition:var(--transition);
  user-select:none;
}
.fence-type-options label:hover{border-color:var(--accent);color:var(--accent)}
.fence-type-options input[type="checkbox"]{width:auto;accent-color:var(--accent);margin:0}
.fence-type-options label:has(input:checked){
  border-color:var(--accent);
  color:var(--accent-dark);
  background:var(--accent-pale);
}
```

- [ ] **Step 2: Verify styles load without errors**

Open `plotys.html` in a browser (file:// is fine). Open DevTools → Console. Confirm no CSS parse errors. No visual change yet — the classes aren't in the HTML yet.

---

### Task 2: Add HTML — nav button and inquiry modal

**Files:**
- Modify: `plotys.html`

- [ ] **Step 1: Add the nav button**

In `plotys.html`, find the nav `<ul>`. The last `<li>` currently reads:
```html
        <li><a href="eshop.html" class="nav-cta">E-shop →</a></li>
```

Add a new `<li>` immediately after it:
```html
        <li><a href="#" class="nav-inquiry" onclick="openInquiryModal();return false;">Poptávka</a></li>
```

- [ ] **Step 2: Add the inquiry modal HTML**

In `plotys.html`, find the existing admin modal block:
```html
<!-- ============ ADMIN STATUS MODAL ============ -->
<div class="modal" id="adminModal">
```

Insert the inquiry modal **immediately before** that block:

```html
<!-- ============ INQUIRY MODAL ============ -->
<div class="modal" id="inquiryModal">
  <div class="modal-content">
    <button class="modal-close" onclick="closeInquiryModal()">×</button>
    <h2>Poptávka</h2>
    <form onsubmit="submitInquiry(event)">
      <div class="form-row">
        <input type="text" name="name" placeholder="Jméno" required>
        <input type="tel" name="phone" placeholder="Telefon" required>
      </div>
      <input type="email" name="email" placeholder="E-mail" required>
      <input type="text" name="address" placeholder="Adresa" required>
      <div>
        <div class="inquiry-field-label">Typ plotu <span>(nepovinné)</span></div>
        <div class="fence-type-options">
          <label><input type="checkbox" name="fenceType" value="Drátěné"><span>Drátěné</span></label>
          <label><input type="checkbox" name="fenceType" value="Betonové"><span>Betonové</span></label>
          <label><input type="checkbox" name="fenceType" value="Dřevěné"><span>Dřevěné</span></label>
          <label><input type="checkbox" name="fenceType" value="Mobilní"><span>Mobilní</span></label>
          <label><input type="checkbox" name="fenceType" value="Brány"><span>Brány</span></label>
          <label><input type="checkbox" name="fenceType" value="Příslušenství"><span>Příslušenství</span></label>
        </div>
      </div>
      <textarea name="requirements" placeholder="Délka plotu, typ terénu, termín..." rows="4"></textarea>
      <button type="submit" class="btn btn-primary btn-full">
        Odeslat poptávku
        <svg class="arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
      </button>
    </form>
  </div>
</div>

```

- [ ] **Step 3: Verify HTML renders correctly**

Reload `plotys.html` in the browser. Confirm:
- "Poptávka" button appears in the nav bar to the right of "E-shop →", styled as an outlined green pill
- On the homepage hero (transparent header, before scrolling), the button appears white-outlined
- After scrolling past the hero, the button turns green-outlined on white background
- Clicking the button does nothing yet (JS not wired up) — expected

---

### Task 3: Add JS — open, close, and submit functions

**Files:**
- Modify: `script.js` (append at the end)

- [ ] **Step 1: Add the three functions to script.js**

Append the following block at the very end of `script.js`:

```javascript
// ============================
// INQUIRY (POPTÁVKA)
// ============================

function openInquiryModal() {
  document.getElementById('inquiryModal').classList.add('active');
}

function closeInquiryModal() {
  document.getElementById('inquiryModal')?.classList.remove('active');
}

async function submitInquiry(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const notifyEmail = localStorage.getItem('plotys_notify_email') || 'postavplot@gmail.com';

  const checkedTypes = [...form.querySelectorAll('input[name="fenceType"]:checked')]
    .map(cb => cb.value).join(', ') || '–';

  const formData = new FormData();
  formData.append('_subject', 'Nová poptávka - Plotys');
  formData.append('_template', 'table');
  formData.append('Jméno', fd.get('name'));
  formData.append('Telefon', fd.get('phone'));
  formData.append('Email', fd.get('email'));
  formData.append('Adresa', fd.get('address'));
  formData.append('Typ plotu', checkedTypes);
  formData.append('Požadavky', fd.get('requirements') || '–');

  try {
    await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(notifyEmail)}`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: formData
    });
    closeInquiryModal();
    showToast('✓ Poptávka byla odeslána. Brzy se vám ozveme.', 'success');
    form.reset();
  } catch (err) {
    console.warn('Poptávka selhala:', err);
    showToast('Nepodařilo se odeslat poptávku. Zkuste to prosím znovu.', 'error');
  }
}
```

- [ ] **Step 2: Verify modal open/close**

Reload `plotys.html`. Check:
- Clicking "Poptávka" in the nav opens the modal with the form
- Clicking × closes the modal
- Pressing Escape closes the modal (handled by the existing ESC listener in script.js)
- Page behind modal dims with backdrop blur

- [ ] **Step 3: Verify form validation**

With the modal open:
- Click "Odeslat poptávku" with all fields empty → browser blocks submission, highlights required fields (Jméno, Telefon, E-mail, Adresa)
- Fill required fields, leave checkboxes and Požadavky empty → submit is allowed (optional fields)
- Check one or more fence type pills → they highlight green on check

- [ ] **Step 4: Verify mobile menu**

Resize browser to < 768px (or use DevTools device emulation):
- "Poptávka" appears in the mobile slide-out nav
- Tapping it closes the menu and opens the modal

---

### Task 4: Final end-to-end test and commit

- [ ] **Step 1: Full submit test**

Open `plotys.html` via a local web server (e.g. VS Code Live Server, or `npx serve .`) — FormSubmit requires an actual HTTP request, not file://.

Fill in all fields and submit. Within a few seconds:
- Modal closes
- Green toast "✓ Poptávka byla odeslána. Brzy se vám ozveme." appears at the bottom
- Form resets to empty

Check `postavplot@gmail.com` inbox (or whichever email is set in `plotys_notify_email` localStorage) for the formatted table email from FormSubmit.

- [ ] **Step 2: Commit**

```bash
git add styles.css plotys.html script.js
git commit -m "feat: add Poptávka inquiry form to nav"
```
