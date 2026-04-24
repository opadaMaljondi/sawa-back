import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { isFirebaseClientConfigured } from '../../services/firebaseClient';
import {
    getBrowserNotificationPermission,
    requestBrowserNotificationPermission,
} from '../../utils/browserNotifications';
import './BrowserAlertsBanner.css';

const BrowserAlertsBanner = () => {
    const { t } = useTranslation();
    const { user, isAuthenticated } = useAuth();
    const [perm, setPerm] = useState(getBrowserNotificationPermission);

    useEffect(() => {
        setPerm(getBrowserNotificationPermission());
    }, [isAuthenticated, user?.id]);

    const visible =
        isAuthenticated &&
        user?.type === 'admin' &&
        isFirebaseClientConfigured() &&
        perm !== 'unsupported' &&
        (perm === 'default' || perm === 'denied');

    if (!visible) {
        return null;
    }

    const handleEnable = async () => {
        await requestBrowserNotificationPermission();
        setPerm(getBrowserNotificationPermission());
    };

    return (
        <div className={`admin-browser-alerts-banner ${perm === 'denied' ? 'is-denied' : ''}`}>
            <p>
                {perm === 'denied'
                    ? t('notifications.browserAlertsDenied')
                    : t('notifications.browserAlertsBanner')}
            </p>
            {perm === 'default' && (
                <button type="button" onClick={handleEnable}>
                    {t('notifications.enableBrowserAlerts')}
                </button>
            )}
        </div>
    );
};

export default BrowserAlertsBanner;
