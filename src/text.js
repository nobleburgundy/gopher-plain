// Helpers for laying out fixed-width text that may contain links or bold text.
// Widths are measured on the visible text, so HTML tags don't throw off alignment.

export const WIDTH = 44;

export const len = (s) => [...String(s)].length;

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function truncate(text, width) {
  const t = String(text ?? '');
  return len(t) > width ? [...t].slice(0, Math.max(0, width - 1)).join('') + '…' : t;
}

// One fixed-width column. Options: align ('left' | 'right'), href, bold.
export function cell(text, width, { align = 'left', href, bold } = {}) {
  const t = truncate(text, width);
  const gap = ' '.repeat(Math.max(0, width - len(t)));
  let html = esc(t);
  if (href) html = `<a href="${esc(href)}">${html}</a>`;
  if (bold) html = `<b>${html}</b>`;
  return align === 'right' ? gap + html : html + gap;
}

// Left and right text on one line, filling the width between them.
export function spread(left, right, width = WIDTH, opts = {}) {
  const r = truncate(right, width);
  const l = truncate(left, Math.max(0, width - len(r) - 1));
  return cell(l, width - len(r), opts.left) + cell(r, len(r), opts.right);
}

// Word-wrap plain text. Lines after the first get `indent` spaces.
export function wrap(text, width = WIDTH, indent = 0) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const limit = lines.length ? width - indent : width;
    if (line && len(line) + 1 + len(w) > limit) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines.map((l, i) => (i ? ' '.repeat(indent) : '') + esc(l));
}

// A bordered card around lines (each `WIDTH - 4` characters wide). The border is CSS,
// because Courier New has no box-drawing characters and borrowed ones don't line up.
export function box(lines) {
  return `<span class="card">${lines.join('\n')}</span>`;
}

export const heading = (s) => `<b>${esc(s.toUpperCase())}</b>`;
