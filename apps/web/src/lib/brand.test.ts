import { describe, expect, it } from 'vitest';
import { brandCss, contrastWithWhite, readableBrand } from './brand';

describe('readableBrand', () => {
  it('keeps a colour white text is readable on', () => {
    expect(readableBrand('#D13F53')).toBe('#d13f53');
  });

  it('darkens a light colour until white text reaches 4.5:1', () => {
    const c = readableBrand('#ffd84d');
    expect(c).not.toBeNull();
    expect(contrastWithWhite(c ?? '')).toBeGreaterThanOrEqual(4.5);
  });

  it('refuses anything that is not #rrggbb, so nothing else reaches CSS', () => {
    expect(readableBrand('red')).toBeNull();
    expect(brandCss('#123456;}body{display:none')).toBeNull();
  });
});

describe('brandCss', () => {
  it('sets the brand tokens for light and dark from one colour', () => {
    const css = brandCss('#2f6b4f') ?? '';
    expect(css).toContain(':root{--brand:#2f6b4f;');
    expect(css).toContain("[data-theme='dark']{--brand-ink:");
  });
});
