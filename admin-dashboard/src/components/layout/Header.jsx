import React, { useState } from 'react';
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
    Menu
} from 'lucide-react';
import './Header.css';

const Header = ({ onMenuClick }) => {
    const { t } = useTranslation();
    const { language, toggleLanguage } = useLanguage();
    const { theme, toggleTheme } = useTheme();
    const { user, logout } = useAuth();
    const [showProfileMenu, setShowProfileMenu] = useState(false);

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

                <button className="header-icon-btn header-notifications" title={t('common.notifications')}>
                    <Bell size={20} />
                    <span className="header-notification-badge">3</span>
                </button>

                <div className="header-profile">
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
                            <a href="/profile" className="header-profile-menu-item">
                                <User size={16} />
                                <span>{t('common.profile')}</span>
                            </a>
                            <a href="/settings" className="header-profile-menu-item">
                                <Settings size={16} />
                                <span>{t('common.settings')}</span>
                            </a>
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
