# Inquiry Form (Poptávka) — Design Spec
Date: 2026-05-12

## Overview
Add a "Poptávka" button to the main navigation on `plotys.html`. Clicking it opens a modal form where visitors submit an inquiry. The submission is emailed to the owner via FormSubmit so they can prepare a price quote.

## Nav Button
- Added to the `<nav>` list in `plotys.html`, after the existing "E-shop →" link
- Style: outlined green pill — white background, `var(--accent)` border and text — visually secondary to the filled E-shop button
- Label: `Poptávka`
- `onclick="openInquiryModal()"`

## Modal
Reuses the existing `.modal` pattern (same as `adminModal` and `checkoutModal`).

- **ID:** `inquiryModal`
- **Title:** `<h2>Poptávka</h2>` — large, no subtitle
- **Close button:** standard `.modal-close` ×

### Fields
| Field | Label | Type | Required |
|---|---|---|---|
| name | Jméno | text input | ✅ |
| phone | Telefon | tel input | ✅ |
| email | E-mail | email input | ✅ |
| address | Adresa | text input | ✅ |
| fenceTypes | Typ plotu | 6 checkboxes | ❌ optional |
| requirements | Požadavky | textarea | ❌ optional |

**Fence type checkboxes** (pill style, inline flex-wrap):
Drátěné, Betonové, Dřevěné, Mobilní, Brány, Příslušenství

**Requirements textarea:** placeholder "Délka plotu, typ terénu, termín..."

### Submit button
`Odeslat poptávku →` — full width, `btn btn-primary`

## Submission
Uses FormSubmit (same pattern as contact form and order notifications).

- Target email: `localStorage.getItem('plotys_notify_email') || 'postavplot@gmail.com'`
- Subject: `Nová poptávka - Plotys`
- Fields sent: Jméno, Telefon, Email, Adresa, Typ plotu (comma-joined checked values or "–"), Požadavky (or "–" if empty)
- On success: close modal, show green toast "✓ Poptávka byla odeslána. Brzy se vám ozveme."
- On network error: show error toast, form stays open

## Implementation scope
Changes are limited to **`plotys.html`** and **`script.js`**:
- `plotys.html`: nav link, modal HTML, toast div already present
- `script.js`: `openInquiryModal()`, `closeInquiryModal()`, `submitInquiry(e)` functions

No new files needed.
