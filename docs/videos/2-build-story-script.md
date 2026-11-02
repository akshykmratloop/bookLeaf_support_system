# How I built it, mapped to the brief — script

21 scenes · 458 words of narration · 3:48 · AI voice (ash) · music and effects composed for the video.

## 1. The brief

*At 0:00 — on screen:* Four cards: author portal, admin portal, REST API, AI that sorts and drafts

BookLeaf's brief: thousands of author questions, all answered by hand. Build an author portal, an admin portal, a REST API, and AI that sorts and drafts replies.

## 2. How I built it, and why

*At 0:14 — on screen:* A terminal types out the build history, commit by commit

I built BookLeaf's new author support system. Here's how, and why.

## 3. The obvious move

*At 0:20 — on screen:* Two cards: the shortcut, and its catch

The obvious move? Bolt on AI to type replies faster. But a confident wrong number is worse than a slow reply.

## 4. The real problem

*At 0:29 — on screen:* Three cards: correct answers, money first, never stops

So I reframed it. Correct answers in front of a human, fast. Money issues first. And a desk that never stops when the AI does.

## 5. Three rules

*At 0:39 — on screen:* Three cards on a dark background

Three rules. Code computes the facts, AI only writes the words. A human always sends. And tickets never depend on the AI.

## 6. The two portals

*At 0:49 — on screen:* The author's ticket list and the staff queue with filters

Authors get a portal to sign in, see their books, raise tickets, and watch replies arrive live. Staff get a queue with filters, status, notes, and assignment.

## 7. AI classification and drafts

*At 1:03 — on screen:* The six categories, priority with override, the knowledge base

The AI sorts every ticket into BookLeaf's six categories, sets one of four priorities, and drafts a reply from the knowledge base. Staff can override all of it.

## 8. A safe AI pipeline

*At 1:16 — on screen:* Flow: ticket, triage, real data, AI draft, fact checker, human sends

Every ticket flows through a safe pipeline: triage, real data, an AI draft, then a checker that verifies every amount and date.

## 9. Measured

*At 1:26 — on screen:* Counters: 45/46 classified right; 87% with the AI off

And I measured it: forty-five of forty-six test tickets classified right, Hindi and Hinglish included. Even with the AI switched off, simple rules got eighty-seven percent.

## 10. Cost, by design

*At 1:40 — on screen:* Four cards: small model sorts, stronger model drafts, lean prompts, usage visible

Cost was a design choice. A small, fast model sorts. A stronger one only writes drafts. Each prompt carries just the facts it needs, and admins can see the usage.

## 11. Graceful degradation

*At 1:53 — on screen:* Template draft and keyword rules while the AI is off

And if the AI fails, keyword rules and template drafts take over, so the desk never stops.

## 12. Not a portal, a module

*At 2:03 — on screen:* Dashboard, widget and the platform customer list

Then the big idea: don't make authors leave their dashboard. Support became a module that plugs into any product, for any company. BookLeaf is just workspace number one.

## 13. Architecture

*At 2:16 — on screen:* Flow diagram: dashboard, web app, API, BookLeaf server, shared Zod

Under the hood: one TypeScript monorepo, four apps, and one shared set of Zod schemas.

## 14. Why this stack

*At 2:25 — on screen:* Eight technology cards

Fastify and Postgres with row-level security. React and Tailwind. Claude for triage and drafts. OpenAI Realtime for voice. Real databases in every test.

## 15. The REST API

*At 2:38 — on screen:* Swagger docs: versioned routes, sign-in, roles, validation

Everything runs through a versioned REST API, with sign-in, role-based access, validation on every request, and full Swagger docs.

## 16. Beyond the brief

*At 2:50 — on screen:* Chat and voice thread; the voice ticket filling in

Then I went beyond the brief: chat and voice in one thread, and calls that fill in the ticket while you talk.

## 17. Problems I hit

*At 2:58 — on screen:* Problem cards that flip over to show the fix

It wasn't all smooth. Vercel can't carry WebSockets, so calls get a one-time ticket to the API. An audit found cross-company leaks, so I fixed them and added row-level security.

## 18. Quality

*At 3:11 — on screen:* Counter: 1,200+ automated tests

Quality was a habit: over twelve hundred automated tests, all green, on real databases.

## 19. Live on AWS + Vercel

*At 3:22 — on screen:* Flow: push, tests, backup, AWS + Vercel

It's live on AWS and Vercel. It deploys only when I ask, backs up the database first, and one command tears it all down.

## 20. What's next

*At 3:34 — on screen:* Three cards

Next: a bigger real test set, one-click approvals, and email alerts.

## 21. Outro

*At 3:40 — on screen:* Logo and closing line

From a support portal, to a support module any product can plug in. Thanks for watching.
