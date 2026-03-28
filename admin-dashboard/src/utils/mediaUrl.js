import { storageURL } from '../services/api';

/** Full URL for img src when API returns relative /storage paths (dashboard runs on another origin). */
export function resolveMediaUrl(urlOrPath) {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith('http')) return urlOrPath;
  const clean = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  if (clean.startsWith('/storage')) {
    const host = storageURL.replace(/\/storage$/, '');
    return `${host}${clean}`;
  }
  return `${storageURL}${clean}`;
}
