import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Globe, Mail, Shield, Save, Loader2, Sun, Moon, Monitor, Gift } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { settingsAPI } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';
import './SettingsPage.css';

/** Must match backend Setting::KEYS_META */
const ALLOWED_SETTING_KEYS = [
    'site_name',
    'site_description',
    'contact_email',
    'contact_phone',
    'address',
    'maintenance_mode',
    'allow_registration',
    'referral_program_enabled',
    'referral_first_subscription_discount_percent',
    'referral_first_subscription_discount_fixed',
    'referral_enrollment_bonus',
];

const REFERRAL_DEFAULTS = {
    referral_program_enabled: 'true',
    referral_first_subscription_discount_percent: '0',
    referral_first_subscription_discount_fixed: '0',
    referral_enrollment_bonus: '0',
};

const SettingsPage = () => {
    const { t } = useTranslation();
    const { theme, changeTheme } = useTheme();
    const [activeTab, setActiveTab] = useState('general');
    const [settings, setSettings] = useState([]);
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await settingsAPI.getAll();
            setSettings(res);

            // Map settings to formData
            const data = {};
            res.forEach(item => {
                data[item.key] = item.value;
            });
            setFormData({ ...REFERRAL_DEFAULTS, ...data });
        } catch (e) {
            console.error(e);
            setMessage({ type: 'error', text: 'فشل تحميل الإعدادات' });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            setMessage({ type: '', text: '' });

            // Only send known keys (avoids stray keys; matches server whitelist)
            const settingsToUpdate = ALLOWED_SETTING_KEYS.filter((key) =>
                Object.prototype.hasOwnProperty.call(formData, key)
            ).map((key) => ({ key, value: formData[key] }));

            await settingsAPI.update({ settings: settingsToUpdate });
            setMessage({ type: 'success', text: 'تم حفظ الإعدادات بنجاح' });
        } catch (e) {
            console.error(e);
            setMessage({ type: 'error', text: t('settings.saveError') });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">{t('common.loading')}</div>;

    const tabs = [
        { id: 'general', icon: <Globe size={18} />, label: t('settings.general') },
        { id: 'contact', icon: <Mail size={18} />, label: t('settings.contact') },
        { id: 'system', icon: <Shield size={18} />, label: t('settings.system') },
        { id: 'referral', icon: <Gift size={18} />, label: t('settings.referral') },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <div className="settings-form-grid">
                        <div className="form-item">
                            <label>{t('settings.siteNameLabel')}</label>
                            <Input
                                value={formData.site_name || ''}
                                onChange={(e) => handleChange('site_name', e.target.value)}
                            />
                        </div>
                        <div className="form-item">
                            <label>{t('settings.siteDescriptionLabel')}</label>
                            <textarea
                                className="settings-textarea"
                                value={formData.site_description || ''}
                                onChange={(e) => handleChange('site_description', e.target.value)}
                            />
                        </div>
                    </div>
                );
            case 'contact':
                return (
                    <div className="settings-form-grid">
                        <div className="form-item">
                            <label>{t('settings.contactEmailLabel')}</label>
                            <Input
                                type="email"
                                value={formData.contact_email || ''}
                                onChange={(e) => handleChange('contact_email', e.target.value)}
                            />
                        </div>
                        <div className="form-item">
                            <label>{t('settings.contactPhoneLabel')}</label>
                            <Input
                                value={formData.contact_phone || ''}
                                onChange={(e) => handleChange('contact_phone', e.target.value)}
                            />
                        </div>
                        <div className="form-item">
                            <label>{t('settings.addressLabel')}</label>
                            <Input
                                value={formData.address || ''}
                                onChange={(e) => handleChange('address', e.target.value)}
                            />
                        </div>
                    </div>
                );
            case 'referral':
                return (
                    <div className="settings-form-grid">
                        <p className="settings-hint">{t('settings.referralHint')}</p>
                        <div className="form-item flex-row">
                            <label>{t('settings.referralProgramEnabled')}</label>
                            <input
                                type="checkbox"
                                checked={formData.referral_program_enabled === 'true'}
                                onChange={(e) => handleChange('referral_program_enabled', e.target.checked.toString())}
                            />
                        </div>
                        <div className="form-item">
                            <label>{t('settings.referralFirstSubDiscountPercent')}</label>
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={formData.referral_first_subscription_discount_percent ?? '0'}
                                onChange={(e) => handleChange('referral_first_subscription_discount_percent', e.target.value)}
                            />
                        </div>
                        <div className="form-item">
                            <label>{t('settings.referralFirstSubDiscountFixed')}</label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.referral_first_subscription_discount_fixed ?? '0'}
                                onChange={(e) => handleChange('referral_first_subscription_discount_fixed', e.target.value)}
                            />
                        </div>
                        <div className="form-item">
                            <label>{t('settings.referralEnrollmentBonus')}</label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={ formData.referral_enrollment_bonus ?? '0'}
                                onChange={(e) => handleChange('referral_enrollment_bonus', e.target.value)}
                            />
                        </div>
                    </div>
                );
            case 'system':
                return (
                    <div className="settings-form-grid">
                        <div className="form-item flex-row">
                            <label>{t('settings.maintenanceMode')}</label>
                            <input
                                type="checkbox"
                                checked={formData.maintenance_mode === 'true'}
                                onChange={(e) => handleChange('maintenance_mode', e.target.checked.toString())}
                            />
                        </div>
                        <div className="form-item flex-row">
                            <label>{t('settings.allowRegistration')}</label>
                            <input
                                type="checkbox"
                                checked={formData.allow_registration === 'true'}
                                onChange={(e) => handleChange('allow_registration', e.target.checked.toString())}
                            />
                        </div>
                        <div className="form-item">
                            <label className="settings-label-with-icon">
                                {theme === 'dark' ? <Moon size={16} /> : theme === 'light' ? <Sun size={16} /> : <Monitor size={16} />}
                                {t('common.theme')}
                            </label>
                            <div className="theme-selector-grid">
                                <button
                                    type="button"
                                    onClick={() => changeTheme('light')}
                                    className={`theme-option-btn ${theme === 'light' ? 'active' : ''}`}
                                >
                                    <Sun size={20} />
                                    <span>{t('common.lightMode')}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => changeTheme('dark')}
                                    className={`theme-option-btn ${theme === 'dark' ? 'active' : ''}`}
                                >
                                    <Moon size={20} />
                                    <span>{t('common.darkMode')}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => changeTheme('system')}
                                    className={`theme-option-btn ${theme === 'system' ? 'active' : ''}`}
                                >
                                    <Monitor size={20} />
                                    <span>{t('common.systemMode')}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="settings-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('settings.title')}</h1>
                    <p className="page-subtitle">{t('settings.siteInfo')}</p>
                </div>
            </div>

            <Card className="settings-container">
                <div className="settings-layout">
                    <aside className="settings-sidebar">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`settings-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </aside>

                    <main className="settings-content">
                        <form onSubmit={handleSubmit}>
                            {renderTabContent()}

                            <div className="settings-footer">
                                {message.text && (
                                    <div className={`settings-msg ${message.type}`}>
                                        {message.text}
                                    </div>
                                )}
                                <Button
                                    type="submit"
                                    icon={saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                                    disabled={saving}
                                >
                                    {t('common.save')}
                                </Button>
                            </div>
                        </form>
                    </main>
                </div>
            </Card>
        </div>
    );
};

export default SettingsPage;
