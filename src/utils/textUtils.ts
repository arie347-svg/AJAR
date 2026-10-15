/**
 * Helper utility for text formatting in AJAR MAN 1 Majalengka
 */

/**
 * Converts a string to Proper Case (Capitalizes first letter of each word).
 * Accurately handles word boundaries, hyphens, and specific educational acronyms (BK, OSIS, MAN, PNS, etc.)
 */
export function toProperCase(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/(^|[\s\-\'\.\/])([a-z])/g, (_, boundary, char) => boundary + char.toUpperCase())
    .replace(/\b(Bk|Osis|Pns|Pppk|Man|Mts|Mi|Ra|Ipa|Ips)\b/gi, match => match.toUpperCase());
}

/**
 * Live formatter for input fields as the user types.
 * Preserves trailing spaces while capitalizing words on the fly.
 */
export function formatProperCaseLive(text: string): string {
  if (!text) return '';
  const words = text.split(' ');
  return words
    .map((w, index) => {
      // If trailing empty string (user just typed space), keep it
      if (!w) return '';
      // Capitalize first character, keep remaining characters
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}
