# How I built it — script

16 scenes · 318 words of narration · 2:31 · AI voice (ash) · music and effects composed for the video.

## 1. The scale

*At 0:00 — on screen:* Counters: 1,200+ books a month, 22,000+ titles

Twelve hundred books a month. Twenty-two thousand titles. Every author question, answered by hand.

## 2. How I built it, and why

*At 0:08 — on screen:* A terminal types out the build history, commit by commit

I built BookLeaf's new author support system. Here's how, and why.

## 3. The obvious move

*At 0:14 — on screen:* Two cards: the shortcut, and its catch

The obvious move? Bolt on AI to type replies faster. But a confident wrong number is worse than a slow reply.

## 4. The real problem

*At 0:23 — on screen:* Three cards: correct answers, money first, never stops

So I reframed it. Correct answers in front of a human, fast. Money issues first. And a desk that never stops when the AI does.

## 5. Three rules

*At 0:33 — on screen:* Three cards on a dark background

Three rules. Code computes the facts, AI only writes the words. A human always sends. And tickets never depend on the AI.

## 6. Not a portal, a module

*At 0:43 — on screen:* Dashboard, widget and the platform customer list

Then the big idea: don't make authors leave their dashboard. Support became a module that plugs into any product, for any company. BookLeaf is just workspace number one.

## 7. Architecture

*At 0:56 — on screen:* Flow diagram: dashboard, web app, API, BookLeaf server, shared Zod

Under the hood: one TypeScript monorepo, four apps, and one shared set of Zod schemas.

## 8. Why this stack

*At 1:05 — on screen:* Eight technology cards

Fastify and Postgres with row-level security. React and Tailwind. Claude for triage and drafts. OpenAI Realtime for voice. Real databases in every test.

## 9. A safe AI pipeline

*At 1:18 — on screen:* Flow: ticket, triage, real data, AI draft, fact checker, human sends

Every ticket flows through a safe pipeline: triage, real data, an AI draft, then a checker that verifies every amount and date.

## 10. Measured

*At 1:27 — on screen:* Counters: 45/46 classified right, 9¢ per thousand tickets

And I measured it: forty-five of forty-six tickets classified right, Hindi and Hinglish included, at nine cents per thousand.

## 11. Beyond the brief

*At 1:37 — on screen:* Chat and voice thread; the voice ticket filling in

Then I went beyond the brief: chat and voice in one thread, and calls that fill in the ticket while you talk.

## 12. Problems I hit

*At 1:45 — on screen:* Problem cards that flip over to show the fix

It wasn't all smooth. Vercel can't carry WebSockets, so calls get a one-time ticket to the API. An audit found cross-company leaks, so I fixed them and added row-level security.

## 13. Quality

*At 1:58 — on screen:* Counter: 1,240 automated tests

Quality was a habit: twelve hundred and forty tests, all green, on real databases.

## 14. Live and cheap to run

*At 2:07 — on screen:* Flow: push, tests, backup, AWS + Vercel

It's live on AWS and Vercel. Deploys only when I ask, backups first, and one command tears it all down. About eighteen dollars a month.

## 15. What's next

*At 2:17 — on screen:* Three cards

Next: a bigger real test set, one-click approvals, and email alerts.

## 16. Outro

*At 2:24 — on screen:* Logo and closing line

From a support portal, to a support module any product can plug in. Thanks for watching.
