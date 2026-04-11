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

