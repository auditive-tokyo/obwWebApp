export function formatAddress(val?: string | null): string {
  if (!val) return '';
  const s = String(val).trim();
  if (!s) return '';
  try {
    const obj = JSON.parse(s);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const parts = [
        (obj as any).addressLine1,
        (obj as any).addressLine2,
        (obj as any).city,
        (obj as any).state,
        (obj as any).country,
        (obj as any).zipcode,
      ]
        .map(v => (v == null ? '' : String(v).trim()))
        .filter(Boolean);
      return parts.join(', ');
    }
    return s;
  } catch {
    return s;
  }
}