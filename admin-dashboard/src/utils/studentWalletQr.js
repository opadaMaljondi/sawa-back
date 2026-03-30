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
 * Normalize API / clipboard text → single URL or path string.
 */
function unwrapQrText(text) {
  let raw = String(text).trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (!raw.startsWith('{')) return raw;
  try {
    const o = JSON.parse(raw);
    if (o?.wallet_qr?.value != null) return String(o.wallet_qr.value).trim();
    if (typeof o.value === 'string') return o.value.trim();
  } catch {
    // not JSON
  }
  return raw;
}

/**
 * Parse scanned text → student id.
 * Accepts any host (API :8000 or admin :3000). Tolerates JSON wrappers and missing ?wallet=1.
 * @returns {{ studentId: string } | null}
 */
export function parseStudentWalletQr(text) {
  if (text == null || typeof text !== 'string') return null;

  const raw = unwrapQrText(text);
  if (!raw) return null;

  try {
    let url;
    if (/^https?:\/\//i.test(raw)) {
      url = new URL(raw);
    } else {
      const path = raw.startsWith('/') ? raw : `/${raw}`;
      url = new URL(path, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    }

    const pathMatch = url.pathname.match(/\/students\/(\d+)/i);
    if (!pathMatch) return null;

    const w = url.searchParams.get(WALLET_QR_PARAM);
    // Explicitly wrong: ?wallet=0
    if (w === '0' || w === 'false') return null;
    // Accept missing, 1, true, or empty (?wallet=)
    if (w === null || w === '1' || w === 'true' || w === '') {
      return { studentId: pathMatch[1] };
    }
    return null;
  } catch {
    // Path-only fallback: /students/123 anywhere in string
    const m = raw.match(/\/students\/(\d+)/i);
    return m ? { studentId: m[1] } : null;
  }
}
