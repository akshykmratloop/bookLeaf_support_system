import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  DEMO_AUTHORS,
  DEMO_PASSWORD,
  fillAndSubmit,
  type DemoAuthor,
} from '../../lib/demoAccounts';
import { DemoAccounts } from './DemoAccounts';

type Props = Record<string, unknown> & { children?: ReactNode };

/** Expands hook-free components into host elements, so a test can press a real button's handler. */
function hostElements(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(hostElements);
  if (!isValidElement<Props>(node)) return [];
  if (typeof node.type === 'function')
    return hostElements((node.type as (p: Props) => ReactNode)(node.props));
  return [node, ...hostElements(node.props.children)];
}

const buttonsOf = (node: ReactNode) => hostElements(node).filter((el) => el.type === 'button');

const press = (node: ReactNode, label: string) => {
  const button = buttonsOf(node).find((b) => b.props['aria-label'] === label);
  if (!button) throw new Error(`No button "${label}"`);
  (button.props.onClick as () => void)();
};

describe('DemoAccounts', () => {
  it('lists every demo author as a sign-in button', () => {
    const tree = <DemoAccounts busy={false} activeEmail={null} onPick={vi.fn()} />;
    const labels = buttonsOf(tree).map((b) => b.props['aria-label']);
    expect(labels).toEqual(DEMO_AUTHORS.map((a) => `Sign in as ${a.name}`));
    expect(labels).toHaveLength(10);
  });

  it('signs in with that author and the demo password through the form submit', () => {
    const form = { setEmail: vi.fn(), setPassword: vi.fn(), submit: vi.fn() };
    const onPick = (account: DemoAuthor) => fillAndSubmit(account, form);
    press(
      <DemoAccounts busy={false} activeEmail={null} onPick={onPick} />,
      'Sign in as Kavita Deshmukh',
    );
    expect(form.setEmail).toHaveBeenCalledWith('kavita@bookleaf.com');
    expect(form.setPassword).toHaveBeenCalledWith('TestBookLeaf@123');
    expect(form.submit).toHaveBeenCalledExactlyOnceWith('kavita@bookleaf.com', DEMO_PASSWORD);
  });

  it('disables every author while a sign-in is pending and marks the one in progress', () => {
    const tree = <DemoAccounts busy activeEmail="priya@bookleaf.com" onPick={vi.fn()} />;
    expect(buttonsOf(tree).every((b) => b.props.disabled === true)).toBe(true);
    const html = renderToStaticMarkup(tree);
    expect(html.match(/aria-busy="true"/g)).toHaveLength(1);
    expect(html).toContain('Signing in…');
  });

  it('enables the authors again once nothing is pending', () => {
    const tree = <DemoAccounts busy={false} activeEmail="priya@bookleaf.com" onPick={vi.fn()} />;
    expect(buttonsOf(tree).some((b) => b.props.disabled === true)).toBe(false);
    expect(renderToStaticMarkup(tree)).not.toContain('aria-busy');
  });
});

describe('demo accounts', () => {
  it('has one unique @bookleaf.com login per author', () => {
    const emails = DEMO_AUTHORS.map((a) => a.email);
    expect(new Set(emails).size).toBe(emails.length);
    expect(emails.every((e) => /^[a-z]+@bookleaf\.com$/.test(e))).toBe(true);
  });
});
