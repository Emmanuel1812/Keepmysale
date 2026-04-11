/**
 * Extracts a clean email address from strings like:
 * - "John Doe <john@example.com>"
 * - "'John' <john@example.com>"
 * - "john@example.com"
 */
export function extractCleanEmail(input: string): string {
  if (!input) return "";
  
  // 1. Try to find anything between < and >
  const bracketMatch = input.match(/<([^>]+)>/);
  if (bracketMatch) {
    return bracketMatch[1].trim().toLowerCase();
  }
  
  // 2. Fallback: try to find an email-like pattern in the string
  const emailMatch = input.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    return emailMatch[1].trim().toLowerCase();
  }
  
  // 3. Last fallback: trim and lowercase
  return input.trim().toLowerCase();
}
/**
 * Robustly strips HTML tags and styles from a string.
 */
export function stripHtml(html: string): string {
  if (!html) return "";
  
  // 1. Remove style, script, and head tags and their content
  let text = html.replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, "");
  
  // 2. Remove comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // 3. Remove all other tags
  text = text.replace(/<[^>]+>/g, " ");
  
  // 4. Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
    
  // 5. Normalize whitespace
  return text.replace(/\s+/g, " ").trim();
}
