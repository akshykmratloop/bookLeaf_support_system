import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_WORKSPACE_ID } from '../src/modules/workspaces/constants.js';
import { call, createHarness, deleteWorkspace, type Harness } from './helpers/app.js';

/**
 * Self-serve signup has no email check yet, and AI and voice run on the platform's paid keys.
 * A new company therefore starts with AI, chat and voice off until the support provider (super
 * admin) turns them on in its plan. BookLeaf's own workspace is not affected.
 */
let h: Harness;

const OWNER = {
  workspaceName: 'Plan Default Co',
  slug: 'plan-default-co',
  ownerName: 'Pat Owner',
  email: 'pat@plan-default.example',
  password: 'Correct-Horse-42',
};

beforeAll(async () => {
  h = await createHarness();
  await deleteWorkspace(h.db, OWNER.slug);
});
afterAll(async () => {
  await deleteWorkspace(h.db, OWNER.slug);
  await h.close();
});

describe('a self-signup company starts with paid features off', () => {
  it('creates the plan with AI, chat and voice switched off', async () => {
    const res = await call(h, 'POST', '/signup', undefined, OWNER);
    expect(res.statusCode).toBe(201);
    const plan = await h.db.workspacePlan.findFirstOrThrow({
      where: { workspace: { slug: OWNER.slug } },
    });
    expect(plan).toMatchObject({ aiEnabled: false, chatAllowed: false, voiceAllowed: false });
  });

  it("leaves BookLeaf's own plan on", async () => {
    const plan = await h.db.workspacePlan.findUniqueOrThrow({
      where: { workspaceId: DEFAULT_WORKSPACE_ID },
    });
    expect(plan).toMatchObject({ aiEnabled: true, chatAllowed: true, voiceAllowed: true });
  });
});
