# Browser journey QA - support SaaS (merged branch `feature/support-saas`)

Date: 2026-10-28
Tester: automated agent, real Chromium via chrome-devtools. Read-only: no source, .env or git changes.
Apps: web http://localhost:3600, API http://localhost:3500, BookLeaf host http://localhost:3700.
No AI key and no voice key were set on the server (expected).

## What was run
Six journeys: author on host, staff queue and reply, workspace settings, new sign-up, layout and themes, quick accessibility pass.
Note: I turned chat and voice ON in /admin/assistant for about one minute to see how the widget behaves, then turned both OFF again. No other settings were saved.
Test data left behind: ticket BL-1001 (BookLeaf) with one staff reply, and a new workspace "QA Test Co" (id qa-test-1793138142).

## Results

| # | Journey | Steps | Result | Evidence |
|---|---------|-------|--------|----------|
| 1 | Author on host | Signed in as priya.sharma on :3700, opened Help, widget loaded with Home, Ask, Tickets, History. Chat was "switched off". Raised a ticket by form, it opened as BL-1001, appeared in "Your tickets". | PARTIAL | widget-ask-chat-off-1440.png, widget-ask-unavailable-1440.png, ticket-detail-1440.png |
| 1a | Chat reply | Could not test. Chat is off in the workspace. With it on, the widget says "Chat is unavailable right now" (no AI key). No chat reply or chat-made ticket draft could be produced. | BLOCKED | widget-ask-unavailable-1440.png |
| 1b | Voice button | Call button is disabled with the text "Calls are unavailable right now". With voice off in settings, no call button is shown at all. | PASS (degrades cleanly) | widget-ask-unavailable-1440.png |
| 2 | Staff reply | Logged in as admin. Queue showed BL-1001. Detail page showed a template draft labelled "AI was unavailable", verified facts, and an "AI_NOT_CONFIGURED" note. Reply with invented "₹12,345": "Check facts" showed "Amount ₹12,345 does not match any verified fact", Send became disabled. Direct API call returned 422 CHECK_FAILED (UNSUPPORTED_AMOUNT, overridable). A grounded reply (₹3,570, 14 Feb 2026) passed "Every figure matches a verified fact" and was sent. Author's widget showed the reply and "Needs your reply". | PASS | admin-ticket-checkfacts-1440.png, widget-ticket-dark-host-1440.png |
| 3 | Workspace settings | Visited Workspace Settings, API Keys, Product Connection, Customer Data, Author Assistant, AI Settings. All loaded with no console errors. Connection test with AUTH001 said "Connected, found Priya Sharma: 55 facts, 2 items". Create key is disabled with empty name. Entered `javascript:alert(1)` as widget origin: server answered 422 and nothing was saved, but the only message was a generic toast "Some fields are invalid" (see D2). | PARTIAL | settings-origin-1440.png |
| 4 | New sign-up | Weak password gave "Use at least 12 characters". Strong password created workspace and landed on /admin with an empty queue ("No tickets yet"). BookLeaf ticket by id returned 404, ticket list returned empty. "AI Settings" link is hidden. /admin/ai shows "Platform AI settings are managed by the platform operator". API GET /admin/ai/status and /settings returned 403. | PASS | (text only) |
| 5 | Layout and themes | See notes below. | PASS with defects D3-D5 | admin-queue-*.png, host-widget-dark-*.png, widget-ticket-light-*.png |
| 6 | Accessibility quick pass | Widget Ask page, ticket form, reply box and admin reply box all have accessible names. Tab order in the widget is logical: Back, Home, Ask, Tickets, History, All tickets, reply box, Mark as solved. Send is skipped while empty (disabled). | PASS (see D6) | snapshots |

### Journey 5 notes
- Document never scrolls as a whole: at 420 and 1440, scrollWidth equals viewport width and html/body are `overflow: hidden`. Only inner regions scroll (widget `main`, admin table).
- Host dashboard with widget open: dark at 1440 and 420 looks readable, no white boxes. The widget follows the host theme (`theme=dark` passed by the host), not the browser colour scheme.
- Admin: dark and light at 420 and 1440 work. Inputs and selects turn dark (rgb 19,26,38) in dark mode. The admin does not follow the OS colour scheme; it uses its own toggle.
- Widget composer (reply box) in dark mode was not seen visually, because I could not scroll the embedded frame to it (see "not verified").

## Defects

| ID | Sev | Page | Summary |
|----|-----|------|---------|
| D1 | P2 | Widget Ask, admin /admin/assistant | Chat and voice are OFF by default for the BookLeaf workspace, so the main author feature (ask a question) cannot be reached out of the box. Not a code bug, but worth a decision for the demo. When ON without a key, widget says only "Chat is unavailable right now" (clear, no crash). |
| D2 | P3 | /admin/workspace/settings | Invalid widget origin is rejected (good), but the user only sees a generic toast "Some fields are invalid". No inline error on the field, and the bad text stays in the box. |
| D3 | P3 | /admin queue at 1440 | Filter row is clipped on the right: the second ("Created to") date input is cut off. **Fixed** (date range now spans two grid columns; re-measured at 1440 and 420: no overflow). |
| D4 | — | Host :3700 with widget open at 420 | Reported as the "Close" button covering the panel. **Not a defect on review:** the docked panel ends 88 px above the bottom and the button sits below it, over the host page; the cut-off card is the panel's own scrollable content. |
| D5 | P3 | /admin at 420 | "Sign out" in the top bar wraps onto two lines. |
| D6 | P3 | Staff and widget forms | Console issue: "A form field element should have an id or name attribute (count: 10)" on the admin ticket page. Widget reply box shows no visible focus ring on the textarea itself (outline none); a ring may be on its wrapper, not confirmed. |
| D7 | P3 | /admin/ai as non-platform admin | The forbidden page shows a "Try again" button, which cannot help. Better to show no retry. |
| D8 | P3 | Admin ticket page after sending | After a reply is sent, the "Template draft (AI was unavailable) / Review before sending" banner and the reply box are still shown. (Observed in text only; the Send flow itself worked.) |

Repro for each:
- D1: log in as admin, open /admin/assistant, both switches read "Off"; open widget Ask as an author. Expected: usable chat or clear admin hint. Actual: "Chat is switched off".
- D2: /admin/workspace/settings, type `javascript:alert(1)` into "Pages allowed to embed the widget", click another field. Expected: field-level message. Actual: PUT /api/v1/workspace/settings 422 and toast "Some fields are invalid".
- D3: log in as admin at 1440x900, open /admin, look at the filter row (screenshot admin-queue-dark-1440.png).
- D4: host :3700 at 420x800, click Get help, look at the bottom of the panel (host-widget-dark-420.png).
- D5: /admin at 420x800, see top-right (admin-queue-dark-420.png).
- D6: open /admin/tickets/<id>, list console issues.
- D7: sign up a new workspace, open /admin/ai.
- D8: send a reply on a ticket, look below the thread.

Console and network: no JS errors anywhere. Only failed requests seen were expected: 401 on first load before sign-in (host /api/dashboard, /auth/me), 403 for the new workspace on platform AI routes, and 422s from my own deliberate bad inputs. Vite dev messages only.
Nothing blocked or crashed. No P0 or P1 found.

## Could not verify
- Real chat answers and chat-made ticket drafts: no AI key, chat off by default.
- Voice call and microphone permission: no voice key; needs a manual test with a real mic and key.
- Real AI draft quality: only the rule-based template draft was seen.
- Widget reply box in dark mode and the keyboard focus ring: could not scroll the embedded frame with the tools available.
- Host page in light mode at 1440 with the widget open, and the widget at 420 in a real mobile browser (I used window resizing only).
- Sending a staff override ("send anyway with a reason") was not tried.
- Browser colour-scheme emulation did not change the admin or the standalone widget (they use their own theme toggle or host parameter), so "dark" was tested through those, not through the OS setting.

Screenshots: /private/tmp/claude-501/-Users-aksykmr-mac-Loop-Methods-experiments-bookleaf/d6c4131c-0851-4186-b4ce-5a0f25b3552c/scratchpad/shots/qa/
(Files named widget-standalone-light-*-NOT-dark.png are light theme despite my first naming.)
