/** The value at a dotted path (`data.user.name`, `books.0.id`); `$` is the whole value. */
export function readPath(json: unknown, path: string): unknown {
  if (path === '$') return json;
  let current: unknown = json;
  for (const segment of path.split('.')) {
    if (Array.isArray(current)) {
      current = /^\d+$/.test(segment) ? current[Number(segment)] : undefined;
    } else if (current !== null && typeof current === 'object' && Object.hasOwn(current, segment)) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}
