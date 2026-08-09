import DOMPurify from "dompurify";

/**
 * Sanitizes an HTML string to prevent XSS attacks.
 * It removes unsafe tags (like <script>), inline event handlers, and javascript URIs.
 * It preserves safe formatting tags like headings, paragraphs, lists, links, and bold text.
 *
 * @param {string} html - The raw, potentially unsafe HTML string.
 * @returns {string} - The sanitized, safe HTML string.
 */
export const sanitizeHtml = (html) => {
  if (typeof html !== "string" || !html) {
    return "";
  }

  // DOMPurify blocks scripts, javascript: URLs, and inline event handlers by default.
  // We explicitly configure allowed tags and attributes for added safety while
  // preserving expected document formatting.
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "b",
      "i",
      "em",
      "strong",
      "a",
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "br",
      "hr",
      "blockquote",
      "span",
      "div",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "img",
      "mark",
    ],
    ALLOWED_ATTR: [
      "href",
      "title",
      "target",
      "src",
      "alt",
      "class",
      "style",
      "id",
    ],
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
  });
};
