/**
 * Two-letter initials from a person's display name.
 * "John Ferrara" → "JF"; single word "Madonna" → "MA"; empty/unknown → null.
 */
export function initialsFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
