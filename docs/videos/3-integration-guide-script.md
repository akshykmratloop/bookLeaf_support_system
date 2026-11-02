# Plug BookLeaf Support into any product — script

16 scenes · 271 words of narration · 2:02 · AI voice (nova) · music and effects composed for the video.

## 1. BookLeaf first, then any product

*At 0:00 — on screen:* Kinetic title: help inside the dashboard, one script tag, one endpoint

BookLeaf's authors now get help right inside their own dashboard. Any product can do the same, with one script tag, and one endpoint.

## 2. Integration guide

*At 0:10 — on screen:* The six steps pop in as numbered cards

Here's how to plug BookLeaf Support into any product.

## 3. The big picture

*At 0:15 — on screen:* Flow: your page and your server → BookLeaf Support → your existing APIs

Your page loads one script. Your server says who the customer is, with a short-lived token. And support reads facts from the APIs you already have. Nothing is copied.

## 4. Step 1 — create your workspace

*At 0:27 — on screen:* Screenshot `w01b-signup-filled`, zooming to the workspace id

Step one: create your workspace. Its id becomes your widget's address.

## 5. A checklist that ticks itself

*At 0:33 — on screen:* Screenshot `w02-get-started-new`

You get a checklist that ticks itself, as each step really starts working.

## 6. Step 2 — connect your data

*At 0:38 — on screen:* Screenshots `w05-connection` and `w06-connection-test`

Step two: connect your data. Add your API key and secret, list your data sources, and press Test to see exactly what comes back.

## 7. Step 3 — map your fields

*At 0:48 — on screen:* Screenshot `w08-mapping`, zooming to the mapped preview

Step three: map your fields to the JSON your API already sends. These are the only figures the AI is allowed to quote.

## 8. Step 4 — the sign-in endpoint

*At 0:56 — on screen:* The token endpoint typed out (same code as `docs/integration.md` §2a)

Step four is the only real code: one endpoint, behind your own login, that signs a five-minute token for the current customer.

## 9. Why the token is safe

*At 1:05 — on screen:* Four cards: works once, expires fast, out of logs, own customers only

That token works once, expires fast, stays out of server logs, and can only sign in your own customers.

## 10. Step 5 — the script tag

*At 1:14 — on screen:* Screenshots `w03b-step-widget` and `w09-widget-branding`

Step five: paste one script tag, and list the websites allowed to show it.

## 11. The widget appears

*At 1:20 — on screen:* Screenshots `a02-dashboard` and `a04-widget-home`

And that's it. The widget just appears, already signed in, in your brand colours.

## 12. Step 6 — teach the AI

*At 1:26 — on screen:* Screenshots `w12-categories`, `w13-knowledge`, `w10-ai-writes`

Step six: teach the AI. Add your categories, your knowledge articles, and how replies should sound.

## 13. API keys

*At 1:35 — on screen:* Screenshots `w14-api-keys` and `d01-swagger`

Want more? Scoped API keys let your backend create and read tickets, with every route documented in Swagger.

## 14. Webhooks

*At 1:43 — on screen:* A signed webhook delivery typed out

And signed webhooks tell your server about every new ticket, reply, and status change.

## 15. Test and go live

*At 1:51 — on screen:* Screenshots `w16-test-ticket` and `s02-queue`

Send a test ticket, watch it land in your queue, and you're live.

## 16. Outro

*At 1:56 — on screen:* Logo and closing line

One script tag. One endpoint. Everything else is configuration.
