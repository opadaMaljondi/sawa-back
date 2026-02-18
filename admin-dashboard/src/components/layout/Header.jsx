import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import {
    Search,
    Bell,
    Sun,
    Moon,
    Globe,
    User,
    Settings,
    LogOut,
    Menu,
    Clock,
    Check,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { notificationsAPI } from '../../services/api';
import './Header.css';

const Header = ({ onMenuClick }) => {
    const { t } = useTranslation();
    const { language, toggleLanguage } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    const { user, logout } = useAuth();
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    // Notifications State
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const notificationRef = useRef(null);
    const profileRef = useRef(null);

    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 60000); // Poll every minute
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (showNotifications) {
            fetchRecentNotifications();
        }
    }, [showNotifications]);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setShowProfileMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchUnreadCount = async () => {
        try {
            const res = await notificationsAPI.getUnreadCount();
            setUnreadCount(res.unread_count);
        } catch (error) {
            console.error('Error fetching unread count:', error);
        }
    };

    const fetchRecentNotifications = async () => {
        setLoading(true);
        try {
            const res = await notificationsAPI.getNotifications(1);
            setNotifications(res.data?.data?.slice(0, 5) || []);
        } catch (error) {
            console.error('Error fetching recent notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkAsRead = async (e, id) => {
        e.stopPropagation();
        e.preventDefault();
        try {
            await notificationsAPI.markAsRead(id);
            setNotifications(prev => prev.map(n =>
                n.id === id ? { ...n, read: true } : n
            ));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('ar-EG', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <header className="header">
            <div className="header-left">
                <button className="header-menu-btn" onClick={onMenuClick}>
                    <Menu size={20} />
                </button>

                <div className="header-search">
                    <Search size={18} className="header-search-icon" />
                    <input
                        type="text"
                        placeholder={t('common.search')}
                        className="header-search-input"
                    />
                </div>
            </div>

            <div className="header-right">
                <button
                    className="header-icon-btn"
                    onClick={toggleTheme}
                    title={theme === 'light' ? t('common.darkMode') : t('common.lightMode')}
                >
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>

                <button
                    className="header-icon-btn"
                    onClick={toggleLanguage}
                    title={t('common.language')}
                >
                    <Globe size={20} />
                    <span className="header-lang-text">{language.toUpperCase()}</span>
                </button>

                <div className="header-notifications-wrapper" ref={notificationRef}>
                    <button
                        className={`header-icon-btn header-notifications ${showNotifications ? 'active' : ''}`}
                        title={t('common.notifications')}
                        onClick={() => setShowNotifications(!showNotifications)}
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <span className="header-notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="header-notif-dropdown">
                            <div className="notif-dropdown-header">
                                <h3>{t('common.notifications')}</h3>
                                {unreadCount > 0 && <span className="unread-cnt-tag">{unreadCount} جديد</span>}
                            </div>

                            <div className="notif-dropdown-body">
                                {loading && notifications.length === 0 ? (
                                    <div className="notif-loading">
                                        <Loader2 className="animate-spin" size={24} />
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="notif-empty">
                                        <Bell size={32} opacity={0.2} />
                                        <p>لا توجد إشعارات</p>
                                    </div>
                                ) : (
                                    notifications.map(notif => (
                                        <div key={notif.id} className={`notif-dropdown-item ${notif.read ? 'read' : 'unread'}`}>
                                            <div className="notif-dot"></div>
                                            <div className="notif-info">
                                                <p className="notif-title">{notif.title}</p>
                                                <p className="notif-desc">{notif.message}</p>
                                                <div className="notif-meta">
                                                    <Clock size={12} />
                                                    <span>{formatDate(notif.created_at)}</span>
                                                </div>
                                            </div>
                                            {!notif.read && (
                                                <button
                                                    className="notif-read-btn"
                                                    onClick={(e) => handleMarkAsRead(e, notif.id)}
                                                    title="تحديد كمقروء"
                                                >
                                                    <Check size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>

                            <Link to="/notifications" className="notif-dropdown-footer" onClick={() => setShowNotifications(false)}>
                                {t('notifications.viewAll')}
                            </Link>
                        </div>
                    )}
                </div>

                <div className="header-profile" ref={profileRef}>
                    <button
                        className="header-profile-btn"
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                    >
                        <div className="header-avatar">
                            <User size={18} />
                        </div>
                        <div className="header-user-info">
                            <span className="header-user-name">{user?.name || 'Admin'}</span>
                            <span className="header-user-role">{user?.role || 'Administrator'}</span>
                        </div>
                    </button>

                    {showProfileMenu && (
                        <div className="header-profile-menu">
                            <Link to="/profile" className="header-profile-menu-item" onClick={() => setShowProfileMenu(false)}>
                                <User size={16} />
                                <span>{t('common.profile')}</span>
                            </Link>
                            <Link to="/settings" className="header-profile-menu-item" onClick={() => setShowProfileMenu(false)}>
                                <Settings size={16} />
                                <span>{t('common.settings')}</span>
                            </Link>
                            <div className="header-profile-menu-divider"></div>
                            <button className="header-profile-menu-item" onClick={logout}>
                                <LogOut size={16} />
                                <span>{t('common.logout')}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
