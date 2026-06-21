/**
 * textPreview.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Builds a clean, plain-text snippet from raw note content for places that
 * show a preview as plain text (card list, explore list) rather than through
 * MarkdownPreview's full renderer.
 *
 * Strips:
 *  - HTML tags (e.g. someone typed/pasted `<h4>Paragraph</h4>` literally —
 *    previously this leaked through as visible text on cards)
 *  - Common markdown punctuation (#, *, `, ~, > for blockquotes, list dashes)
 */
export function toPreviewText(content, maxLength = 120) {
  if (!content) return '';

  return content
    .replace(/<[^>]*>/g, ' ')          // strip HTML tags entirely
    .replace(/^[ \t]*>\s?/gm, '')      // blockquote markers at line start
    .replace(/^[ \t]*[-*+]\s+/gm, '')  // unordered list markers
    .replace(/^[ \t]*\d+\.\s+/gm, '')  // ordered list markers
    .replace(/[#*`~]/g, '')            // remaining markdown punctuation
    .replace(/\s+/g, ' ')              // collapse whitespace/newlines
    .trim()
    .slice(0, maxLength);
}
