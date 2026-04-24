import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, get, onChildAdded } from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';

/**
 * يطابق إعداد Laravel: config('firebase.realtime_prefix') الافتراضي sawa
 * والمسار الذي يكتبه الخادم: {prefix}/admin_alerts
 */
export function adminAlertsDatabasePath() {
    const prefix = import.meta.env.VITE_FIREBASE_RTDB_PREFIX || 'sawa';
    return `${prefix}/admin_alerts`;
}

function readFirebaseConfig() {
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
    if (!apiKey) {
        return null;
    }
    return {
        apiKey,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
        measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
    };
}

export function isFirebaseClientConfigured() {
    const c = readFirebaseConfig();
    return Boolean(
        c?.apiKey && c?.projectId && c?.appId && c?.databaseURL && c?.authDomain,
    );
}

export function getFirebaseApp() {
    if (getApps().length > 0) {
        return getApps()[0];
    }
    const cfg = readFirebaseConfig();
    if (!cfg?.apiKey || !cfg?.projectId || !cfg?.appId || !cfg?.databaseURL) {
        return null;
    }
    return initializeApp(cfg);
}

/**
 * الاستماع لإدخالات جديدة فقط (تجاهل أطفال موجودين قبل الاشتراك).
 *
 * @param {(payload: Record<string, string>) => void} onNewAlert
 * @returns {Promise<() => void>}
 */
export async function subscribeAdminAlerts(onNewAlert) {
    if (!isFirebaseClientConfigured()) {
        return () => {};
    }

    const app = getFirebaseApp();
    if (!app) {
        return () => {};
    }

    if (import.meta.env.VITE_FIREBASE_USE_ANON_AUTH === 'true') {
        try {
            await signInAnonymously(getAuth(app));
        } catch (e) {
            console.warn('[firebase] Anonymous auth failed (enable in Firebase Console if you use rules with auth):', e);
        }
    }

    const db = getDatabase(app);
    const r = ref(db, adminAlertsDatabasePath());
    let initial;
    try {
        initial = await get(r);
    } catch (e) {
        console.warn('[firebase] Could not read admin_alerts. Check Realtime rules and databaseURL:', e);
        return () => {};
    }

    const seen = new Set(initial.exists() ? Object.keys(initial.val()) : []);

    const unsubscribe = onChildAdded(r, (snapshot) => {
        if (seen.has(snapshot.key)) {
            return;
        }
        seen.add(snapshot.key);
        const val = snapshot.val();
        onNewAlert(typeof val === 'object' && val !== null ? val : {});
    });

    return () => unsubscribe();
}
