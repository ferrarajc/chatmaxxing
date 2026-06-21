// Strict input masking for known-format fields. The algorithm mirrors the proven
// helper embedded in OpenAccountPage.tsx so formatting is identical across the app.
// Digit-only, auto-delimited, hard length caps.

export type MaskKind = 'ssn' | 'phone' | 'ein';

export function applyMask(value: string, kind: MaskKind): string {
  const digits = value.replace(/\D/g, '');
  if (kind === 'ssn') {
    const d = digits.slice(0, 9);
    if (d.length <= 3) return d;
    if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`; // XXX-XX-XXXX
  }
  if (kind === 'ein') {
    const d = digits.slice(0, 9);
    return d.length <= 2 ? d : `${d.slice(0, 2)}-${d.slice(2)}`; // XX-XXXXXXX
  }
  // phone: (XXX) XXX-XXXX
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export const MASK_PLACEHOLDER: Record<MaskKind, string> = {
  ssn: 'XXX-XX-XXXX', phone: '(XXX) XXX-XXXX', ein: 'XX-XXXXXXX',
};
export const MASK_MAXLEN: Record<MaskKind, number> = { ssn: 11, phone: 14, ein: 10 };

/** Strip a display/masked phone down to its 10 raw digits. */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10);
}
