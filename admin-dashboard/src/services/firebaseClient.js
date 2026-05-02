import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, get, onChildAdded, query, orderByKey, limitToLast } from 'firebase/database';
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
 * الاستماع لإدخالات جديدة تحت admin_alerts.
 *
 * لا نعتمد على get() لكامل الشجرة (قد يفشل أو يتعطل مع آلاف السجلات).
 * نستخدم sent_at من الخادم: أي حدث أقدم من لحظة الاشتراك بأكثر من maxPastMs
 * يُعتبر أرشيفاً عند أول sync ولا يُطلق له إشعار سطح المكتب.
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
    const notifiedKeys = new Set();
    const subscribedAtMs = Date.now();
    /** هامش زمني (ساعة الخادم مقابل العميل + تأخر الشبكة) */
    const maxPastMs = 120_000;

    try {
        await get(query(r, orderByKey(), limitToLast(1)));
    } catch (e) {
        console.warn(
            '[firebase] Could not read admin_alerts tail (rules/databaseURL). Still listening for new children:',
            e,
        );
    }

    const unsubscribe = onChildAdded(r, (snapshot) => {
        const key = snapshot.key;
        if (!key || notifiedKeys.has(key)) {
            return;
        }
        const val = snapshot.val();
        if (typeof val !== 'object' || val === null) {
            notifiedKeys.add(key);
            return;
        }
        const sentAtRaw = val.sent_at;
        const sentAtMs = typeof sentAtRaw === 'string' ? Date.parse(sentAtRaw) : NaN;
        const now = Date.now();
        const freshEnough =
            Number.isFinite(sentAtMs) &&
            sentAtMs >= subscribedAtMs - maxPastMs &&
            sentAtMs <= now + 120_000;
        if (!freshEnough) {
            notifiedKeys.add(key);
            return;
        }
        notifiedKeys.add(key);
        onNewAlert(val);
    });

    return () => unsubscribe();
}
