/** The workspace's brand colour, made safe to use under white text and inside a style sheet. */
const HEX = /^#[0-9a-f]{6}$/i;
const MIN_CONTRAST = 4.5;
const STEP = 0.06;

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb: number[]) =>
  `#${rgb
    .map((c) =>
      Math.round(Math.max(0, Math.min(255, c)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

function luminance(rgb: number[]): number {
  const [r = 0, g = 0, b = 0] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast of white text on this colour. */
export const contrastWithWhite = (hex: string) => 1.05 / (luminance(channels(hex)) + 0.05);

/** The colour itself when white text on it is readable (4.5:1), else the nearest darker shade. */
export function readableBrand(hex: string): string | null {
  if (!HEX.test(hex)) return null;
  let rgb = channels(hex);
  for (let i = 0; i < 20 && contrastWithWhite(toHex(rgb)) < MIN_CONTRAST; i += 1)
    rgb = rgb.map((c) => c * (1 - STEP));
  return toHex(rgb).toLowerCase();
}

/**
 * Brand tokens for the app's style sheet, derived from one colour (see styles/tokens.css).
 * Only a validated #rrggbb value is ever written into CSS.
 */
export function brandCss(hex: string): string | null {
  const c = readableBrand(hex);
  if (!c) return null;
  const mix = (pct: number, other: string) => `color-mix(in srgb, ${c} ${pct}%, ${other})`;
  return [
    `:root{--brand:${c};--brand-strong:${mix(86, 'black')};--brand-deep:${mix(76, 'black')};`,
    `--brand-bright:${mix(78, 'white')};--brand-ink:${c};--brand-soft:${mix(10, 'white')};}`,
    `[data-theme='dark']{--brand-ink:${mix(58, 'white')};--brand-soft:${mix(20, '#17161a')};}`,
  ].join('');
}
