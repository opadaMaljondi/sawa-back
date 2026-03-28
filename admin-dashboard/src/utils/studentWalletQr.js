/** Query flag used in student wallet QR deep links */
export const WALLET_QR_PARAM = 'wallet';

/**
 * One QR per student: opens wallet context on student profile (type/amount chosen in scanner UI).
 * @param {string|number} studentId
 */
export function buildStudentWalletQrUrl(studentId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = new URL(`/students/${studentId}`, origin || 'http://localhost');
  url.searchParams.set(WALLET_QR_PARAM, '1');
  return url.toString();
}

/**
 * Parse scanned text → student id. Requires `?wallet=1` on `/students/:id` (legacy QRs with `action` still work).
 * @returns {{ studentId: string } | null}
 */
export function parseStudentWalletQr(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  try {
    let url;
    if (/^https?:\/\//i.test(trimmed)) {
      url = new URL(trimmed);
    } else {
      const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
      url = new URL(path, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    }
    const pathMatch = url.pathname.match(/\/students\/(\d+)/);
    if (!pathMatch) return null;
    if (url.searchParams.get(WALLET_QR_PARAM) !== '1') return null;
    return { studentId: pathMatch[1] };
  } catch {
    return null;
  }
}
