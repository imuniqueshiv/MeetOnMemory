import DOMPurify from "dompurify";

const ALLOWED_URI_REGEXP = /^(?:(?:https?|mailto):)/i;

/**
 * Sanitizes untrusted HTML for use in the restricted recap/email preview.
 *
 * The allow-list intentionally contains only the markup needed to display
 * formatted email content. DOMPurify removes scripts, event handlers, and
 * unsafe URL protocols before the HTML is passed to the preview iframe.
 *
 * @param {string} html - The raw, potentially unsafe HTML string.
 * @returns {string} - Sanitized HTML safe for the restricted preview.
 */
export const sanitizeHtml = (html) => {
  if (typeof html !== "string" || !html) {
    return "";
  }

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
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP,
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"],
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
  });
};
