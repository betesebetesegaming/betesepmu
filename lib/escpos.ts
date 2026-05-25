/**
 * Tiny ESC/POS byte builder for thermal printers.
 *
 * Designed for 58 mm thermal paper (≈ 48 mm printable, 32 columns at 1× font).
 * No external dependencies — outputs a Uint8Array that any transport
 * (Web Bluetooth, Sunmi WebView bridge, virtual printer HTTP endpoint) can
 * write byte-for-byte.
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const encoder = new TextEncoder();

const concat = (parts: Uint8Array[]): Uint8Array => {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

const cmd = {
  init: () => new Uint8Array([ESC, 0x40]),
  alignLeft: () => new Uint8Array([ESC, 0x61, 0x00]),
  alignCenter: () => new Uint8Array([ESC, 0x61, 0x01]),
  alignRight: () => new Uint8Array([ESC, 0x61, 0x02]),
  boldOn: () => new Uint8Array([ESC, 0x45, 0x01]),
  boldOff: () => new Uint8Array([ESC, 0x45, 0x00]),
  /** Set text size. width and height are 1..8 multipliers. */
  size: (width: number, height: number) => {
    const w = Math.max(1, Math.min(8, width)) - 1;
    const h = Math.max(1, Math.min(8, height)) - 1;
    return new Uint8Array([GS, 0x21, (w << 4) | h]);
  },
  /** Reverse video (white text on black background) — used for the banner. */
  reverseOn: () => new Uint8Array([GS, 0x42, 0x01]),
  reverseOff: () => new Uint8Array([GS, 0x42, 0x00]),
  feed: (lines = 1) => new Uint8Array([ESC, 0x64, Math.max(0, Math.min(255, lines))]),
  /** Cut paper (partial cut, leaves a small tab uncut). */
  cut: () => new Uint8Array([GS, 0x56, 0x42, 0x00]),
  text: (s: string) => encoder.encode(s),
  newline: () => new Uint8Array([LF]),
};

export type EscPosLineOptions = {
  size?: 1 | 2 | 3 | 4;
  bold?: boolean;
  align?: 'left' | 'center' | 'right';
  reverse?: boolean;
};

const aligned = (align: 'left' | 'center' | 'right'): Uint8Array =>
  align === 'center' ? cmd.alignCenter() : align === 'right' ? cmd.alignRight() : cmd.alignLeft();

/** Build a single line at the given size/style/alignment, terminated by LF. */
export const escPosLine = (text: string, opts: EscPosLineOptions = {}): Uint8Array => {
  const parts: Uint8Array[] = [];
  parts.push(aligned(opts.align ?? 'left'));
  if (opts.size && opts.size > 1) parts.push(cmd.size(opts.size, opts.size));
  else parts.push(cmd.size(1, 1));
  if (opts.bold) parts.push(cmd.boldOn());
  if (opts.reverse) parts.push(cmd.reverseOn());
  parts.push(cmd.text(text));
  parts.push(cmd.newline());
  if (opts.reverse) parts.push(cmd.reverseOff());
  if (opts.bold) parts.push(cmd.boldOff());
  if (opts.size && opts.size > 1) parts.push(cmd.size(1, 1));
  return concat(parts);
};

/** Wrap a long string into lines that fit `cols` columns. Breaks on whitespace where possible. */
export const wrapText = (text: string, cols: number): string[] => {
  if (cols <= 0) return [text];
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (!current) {
      current = w.length > cols ? w.slice(0, cols) : w;
      if (w.length > cols) {
        // Hard break long word
        for (let i = cols; i < w.length; i += cols) {
          lines.push(current);
          current = w.slice(i, i + cols);
        }
      }
      continue;
    }
    if (current.length + 1 + w.length <= cols) {
      current += ' ' + w;
    } else {
      lines.push(current);
      current = w.length > cols ? w.slice(0, cols) : w;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [''];
};

/** Two-column row, left aligned + right aligned, padded with spaces. Single line. */
export const escPosRow = (
  left: string,
  right: string,
  cols: number,
  opts: { size?: 1 | 2 | 3 | 4; bold?: boolean } = {},
): Uint8Array => {
  const w = opts.size ?? 1;
  const effectiveCols = Math.max(1, Math.floor(cols / w));
  const space = Math.max(1, effectiveCols - left.length - right.length);
  const text = `${left}${' '.repeat(space)}${right}`;
  return escPosLine(text, { ...opts, align: 'left' });
};

/** Solid horizontal divider. */
export const escPosDivider = (cols: number, char = '-'): Uint8Array =>
  escPosLine(char.repeat(Math.max(1, cols)), { align: 'left' });

export const escPosFeed = (lines = 1) => cmd.feed(lines);
export const escPosCut = () => cmd.cut();
export const escPosInit = () => cmd.init();

export const escPosConcat = concat;

/**
 * Default printable column width for 58 mm thermal paper at 1× font.
 * 48 mm / 1.5 mm-per-char ≈ 32 columns.
 */
export const DEFAULT_COLS_58MM = 32;
