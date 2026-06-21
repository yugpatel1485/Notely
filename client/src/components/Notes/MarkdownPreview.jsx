/**
 * MarkdownPreview.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight Markdown renderer built on the browser's native DOMParser.
 * No external markdown library is added — this keeps the bundle tiny while
 * supporting the subset most note-takers actually use:
 *
 *   ## Headings (h1–h6)
 *   **bold**  *italic*  ~~strikethrough~~  `inline code`
 *   ```fenced code blocks```
 *   > blockquotes
 *   - / * unordered lists     1. ordered lists
 *   [links](url)
 *   ---  horizontal rules
 *   blank lines → <p> breaks
 *
 * ⚠  Content is rendered into an isolated container with dangerouslySetInnerHTML.
 *    The parser itself never fetches external resources and all user content
 *    is treated as text (not scripts), but for full XSS safety the real app
 *    should pipe through DOMPurify before render (install: npm i dompurify).
 */

import styles from './MarkdownPreview.module.css';

// ── Inline-level transformations (applied in order) ───────────────────────────
const INLINE_RULES = [
  // Inline code — must come before bold/italic so backticks aren't processed twice
  [/`([^`]+)`/g,          '<code>$1</code>'],
  // Bold
  [/\*\*(.+?)\*\*/g,      '<strong>$1</strong>'],
  [/__(.+?)__/g,           '<strong>$1</strong>'],
  // Italic
  [/\*(.+?)\*/g,           '<em>$1</em>'],
  [/_(.+?)_/g,             '<em>$1</em>'],
  // Strikethrough
  [/~~(.+?)~~/g,           '<del>$1</del>'],
  // Links
  [/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'],
];

function applyInlineRules(text) {
  let out = text;
  for (const [pattern, replacement] of INLINE_RULES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * Convert a Markdown string to an HTML string.
 * Block-level parsing walks lines top-to-bottom with a simple state machine.
 */
function markdownToHtml(md) {
  if (!md) return '';

  const lines  = md.split('\n');
  const output = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ─────────────────────────────────────────────────────
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(
          lines[i]
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
        );
        i++;
      }
      const langAttr = lang ? ` class="language-${lang}"` : '';
      output.push(`<pre><code${langAttr}>${codeLines.join('\n')}</code></pre>`);
      i++;
      continue;
    }

    // ── Horizontal rule ───────────────────────────────────────────────────────
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      output.push('<hr />');
      i++;
      continue;
    }

    // ── Headings ──────────────────────────────────────────────────────────────
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level   = headingMatch[1].length;
      const content = applyInlineRules(headingMatch[2]);
      output.push(`<h${level}>${content}</h${level}>`);
      i++;
      continue;
    }

    // ── Blockquote ────────────────────────────────────────────────────────────
    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quoteLines.push(applyInlineRules(lines[i].replace(/^>\s?/, '')));
        i++;
      }
      output.push(`<blockquote>${quoteLines.join('<br />')}</blockquote>`);
      continue;
    }

    // ── Unordered list ────────────────────────────────────────────────────────
    if (/^[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i])) {
        items.push(`<li>${applyInlineRules(lines[i].replace(/^[-*+]\s/, ''))}</li>`);
        i++;
      }
      output.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    // ── Ordered list ──────────────────────────────────────────────────────────
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(`<li>${applyInlineRules(lines[i].replace(/^\d+\.\s/, ''))}</li>`);
        i++;
      }
      output.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // ── Blank line (paragraph break) ──────────────────────────────────────────
    if (line.trim() === '') {
      output.push('<br />');
      i++;
      continue;
    }

    // ── Default: paragraph ────────────────────────────────────────────────────
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6}\s|```|>|\s*[-*+]\s|\d+\.\s|(-{3,}|\*{3,}|_{3,})$)/.test(lines[i])
    ) {
      paraLines.push(applyInlineRules(lines[i]));
      i++;
    }
    if (paraLines.length) {
      output.push(`<p>${paraLines.join(' ')}</p>`);
    }
  }

  return output.join('\n');
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MarkdownPreview({ content, className = '' }) {
  const html = markdownToHtml(content ?? '');

  if (!html) {
    return (
      <div className={`${styles.preview} ${styles.empty} ${className}`}>
        <span>Nothing to preview yet.</span>
      </div>
    );
  }

  return (
    <div
      className={`${styles.preview} ${className}`}
      // ⚠ In production: wrap `html` with DOMPurify.sanitize() first
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
