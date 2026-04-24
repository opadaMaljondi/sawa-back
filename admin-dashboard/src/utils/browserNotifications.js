/** إشعارات سطح المكتب (Web Notification API) */

export function getBrowserNotificationPermission() {
    if (typeof Notification === 'undefined') return 'unsupported';
    return Notification.permission;
}

/**
 * @returns {Promise<'granted' | 'denied' | 'default' | 'unsupported'>}
 */
export async function requestBrowserNotificationPermission() {
    if (typeof Notification === 'undefined') return 'unsupported';
    try {
        const result = await Notification.requestPermission();
        return result;
    } catch {
        return Notification.permission;
    }
}
