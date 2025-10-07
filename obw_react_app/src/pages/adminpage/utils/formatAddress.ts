export function formatAddress(val?: string | null): string {
  if (!val) return '';
  const s = String(val).trim();
  if (!s) return '';
  try {
    const obj = JSON.parse(s);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const o = obj as Record<string, unknown>;
      const parts = [
        o.addressLine1,
        o.addressLine2,
        o.city,
        o.state,
        o.country,
        o.zipcode,
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