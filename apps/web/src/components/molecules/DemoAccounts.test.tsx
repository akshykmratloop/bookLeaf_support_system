import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  DEMO_ADMIN,
  DEMO_PASSWORD,
  fillAndSubmit,
  type DemoStaffAccount,
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

const buttonOf = (node: ReactNode) => {
  const buttons = hostElements(node).filter((el) => el.type === 'button');
  expect(buttons).toHaveLength(1);
  return buttons[0] as ReactElement<Props>;
};

describe('DemoAccounts (staff sign-in)', () => {
  it('signs in as the demo admin with the demo password through the form submit', () => {
    const form = { setEmail: vi.fn(), setPassword: vi.fn(), submit: vi.fn() };
    const onPick = (account: DemoStaffAccount) => fillAndSubmit(account, form);
    (buttonOf(<DemoAccounts isSubmitting={false} onPick={onPick} />).props.onClick as () => void)();
    expect(form.setEmail).toHaveBeenCalledWith('admin@bookleaf.com');
    expect(form.setPassword).toHaveBeenCalledWith('TestBookLeaf@123');
    expect(form.submit).toHaveBeenCalledExactlyOnceWith('admin@bookleaf.com', DEMO_PASSWORD);
  });

  it('is disabled and busy while a sign-in is pending', () => {
    const tree = <DemoAccounts isSubmitting onPick={vi.fn()} />;
    expect(buttonOf(tree).props.disabled).toBe(true);
    expect(renderToStaticMarkup(tree)).toContain('aria-busy="true"');
  });

  it('shows the admin name and email under the label', () => {
    const html = renderToStaticMarkup(<DemoAccounts isSubmitting={false} onPick={vi.fn()} />);
    expect(html).toContain('Sign in as BookLeaf admin (demo)');
    expect(html).toContain(DEMO_ADMIN.name);
    expect(html).toContain(DEMO_ADMIN.email);
    expect(buttonOf(<DemoAccounts isSubmitting={false} onPick={vi.fn()} />).props.disabled).toBe(
      false,
    );
  });
});
