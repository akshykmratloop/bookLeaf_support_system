/** One idempotency key per form instance: a double-click or retry sends the same key. */
export const newRequestKey = (): string => crypto.randomUUID();
