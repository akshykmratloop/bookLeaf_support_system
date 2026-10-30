import type { OnboardingStepId } from '@bookleaf/shared';

/** The wording, links and code samples of the "Get started" guide's eight steps (U-12). */

export interface StepLink {
  to: string;
  label: string;
}

/** A section of docs/integration.md: its heading anchor and a short name. */
export interface DocsSection {
  anchor: string;
  label: string;
}

export interface StepCopy {
  title: string;
  body: string;
  links: StepLink[];
  docs: DocsSection;
  /** Which code sample the step shows, filled in with the workspace's own values. */
  sample?: 'signIn' | 'widget';
}

const LINKS = {
  connection: { to: '/admin/workspace/connection', label: 'Product connection' },
  fields: { to: '/admin/workspace/fields', label: 'Customer data' },
  widget: { to: '/admin/workspace/settings', label: 'Widget settings' },
  categories: { to: '/admin/workspace/categories', label: 'Categories' },
  knowledge: { to: '/admin/workspace/knowledge', label: 'Knowledge base' },
  ai: { to: '/admin/workspace/settings', label: 'AI behaviour' },
  apiKeys: { to: '/admin/workspace/api-keys', label: 'API keys' },
  webhooks: { to: '/admin/workspace/webhooks', label: 'Webhooks' },
  queue: { to: '/admin', label: 'Ticket queue' },
} satisfies Record<string, StepLink>;

const DOCS = {
  connect: { anchor: '2b-serve-the-customer-endpoint', label: '§2b Serve the customer endpoint' },
  sources: {
    anchor: '2c-or-use-the-api-you-already-have-data-sources',
    label: '§2c Data sources',
  },
  signIn: { anchor: '2a-sign-the-customer-in', label: '§2a Sign the customer in' },
  widget: { anchor: 'b-the-widget-one-script-tag', label: '§3b The widget' },
  workspaces: {
    anchor: 'many-products-on-one-support-service-workspaces',
    label: 'Workspaces',
  },
} satisfies Record<string, DocsSection>;

export const STEP_COPY: Record<OnboardingStepId, StepCopy> = {
  connect: {
    title: 'Connect your data',
    body: "Tell support where your product's customer API is and save its key and signing secret. Then press Test.",
    links: [LINKS.connection],
    docs: DOCS.connect,
  },
  fields: {
    title: 'Map customer fields',
    body: 'Choose the customer facts support shows and where each one comes from in your API. Then press Test.',
    links: [LINKS.fields],
    docs: DOCS.sources,
  },
  signIn: {
    title: 'Add the sign-in endpoint',
    body: 'Your server signs a short-lived hand-over token for the signed-in customer, with the signing secret from Product connection. The widget asks this endpoint for a token.',
    links: [LINKS.connection],
    docs: DOCS.signIn,
    sample: 'signIn',
  },
  widget: {
    title: 'Add the widget',
    body: "Paste this tag into your product's pages. It ticks when the widget opens on one of your allowed websites.",
    links: [LINKS.widget],
    docs: DOCS.widget,
    sample: 'widget',
  },
  origins: {
    title: 'Allow your website',
    body: 'List the websites that may show the widget, for example https://app.example.com.',
    links: [LINKS.widget],
    docs: DOCS.widget,
  },
  teach: {
    title: 'Teach the AI',
    body: 'Add at least one category and one knowledge article, and set how the AI writes.',
    links: [LINKS.categories, LINKS.knowledge, LINKS.ai],
    docs: DOCS.workspaces,
  },
  extras: {
    title: 'API keys and webhooks',
    body: 'Optional. Only needed when your own server calls support, or wants to hear about ticket changes.',
    links: [LINKS.apiKeys, LINKS.webhooks],
    docs: DOCS.workspaces,
  },
  test: {
    title: 'Test it',
    body: 'Send a test ticket to see one arrive in your queue. This step ticks when the first ticket from a real customer arrives.',
    links: [LINKS.queue],
    docs: DOCS.widget,
  },
};

/** The guide's link for a docs section, or null when the server has no docs address. */
export const docsHref = (docsUrl: string | null, section: DocsSection): string | null =>
  docsUrl ? `${docsUrl.split('#')[0]}#${section.anchor}` : null;

/** What the product's server runs to hand a signed-in customer over to support. */
export const signInSample = (slug: string): string =>
  `// POST /support-token on your server, for the signed-in customer. Node, with \`jose\`.
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';

const token = await new SignJWT({ name: customer.name, email: customer.email })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuer('${slug}')
  .setSubject(customer.id)
  .setAudience('support')
  .setJti(randomUUID())
  .setIssuedAt()
  .setExpirationTime('300s')
  .sign(new TextEncoder().encode(process.env.SUPPORT_SIGNING_SECRET));

res.json({ token });`;

/** The widget's script tag for this workspace, loaded from the support app. */
export const widgetSample = (supportUrl: string, slug: string): string =>
  `<script
  src="${supportUrl}/embed.js"
  data-workspace="${slug}"
  data-token-url="/support-token"
  data-theme="auto"
  defer
></script>`;

/** Where the workspace's widget page lives, for a preview in a new tab. */
export const widgetPreviewUrl = (supportUrl: string, slug: string): string =>
  `${supportUrl}/embed/${encodeURIComponent(slug)}`;
