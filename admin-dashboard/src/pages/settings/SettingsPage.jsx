import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings, Globe, Mail, Shield, Save, Loader2, Sun, Moon, Monitor, Gift, MessageCircle } from 'lucide-react';
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
    'support_phone',
    'support_email',
    'support_whatsapp',
    'support_telegram',
    'privacy_policy',
    'terms_and_conditions',
    'expired_course_re_enrollment_discount_percent',
];

const SYSTEM_DEFAULTS = {
    expired_course_re_enrollment_discount_percent: '0',
};

const REFERRAL_DEFAULTS = {
    referral_program_enabled: 'true',
    referral_first_subscription_discount_percent: '0',
    referral_first_subscription_discount_fixed: '0',
    referral_enrollment_bonus: '0',
};

const SUPPORT_LEGAL_DEFAULTS = {
    support_phone: '',
    support_email: '',
    support_whatsapp: '',
    support_telegram: '',
    privacy_policy: '',
    terms_and_conditions: '',
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

            const data = { ...SUPPORT_LEGAL_DEFAULTS, ...REFERRAL_DEFAULTS, ...SYSTEM_DEFAULTS };
            res.forEach((item) => {
                data[item.key] = item.value;
            });
            setFormData(data);
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

            const settingsToUpdate = ALLOWED_SETTING_KEYS.map((key) => ({
                key,
                value: formData[key] ?? '',
            }));

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
        { id: 'support', icon: <MessageCircle size={18} />, label: t('settings.supportTab') },
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
            case 'support':
                return (
                    <div className="settings-form-grid">
                        <p className="settings-hint">{t('settings.supportHint')}</p>
                        <div className="form-item">
                            <label>{t('settings.supportPhoneApp')}</label>
                            <Input
                                value={formData.support_phone || ''}
                                onChange={(e) => handleChange('support_phone', e.target.value)}
                                placeholder="+963..."
                            />
                        </div>
                        <div className="form-item">
                            <label>{t('settings.supportEmailApp')}</label>
                            <Input
                                type="email"
                                value={formData.support_email || ''}
                                onChange={(e) => handleChange('support_email', e.target.value)}
                            />
                        </div>
                        <div className="form-item">
                            <label>{t('settings.supportWhatsapp')}</label>
                            <Input
                                value={formData.support_whatsapp || ''}
                                onChange={(e) => handleChange('support_whatsapp', e.target.value)}
                                placeholder="+963..."
                            />
                        </div>
                        <div className="form-item">
                            <label>{t('settings.supportTelegram')}</label>
                            <Input
                                value={formData.support_telegram || ''}
                                onChange={(e) => handleChange('support_telegram', e.target.value)}
                                placeholder="@channel"
                            />
                        </div>
                        <div className="form-item">
                            <label>{t('settings.privacyPolicy')}</label>
                            <textarea
                                className="settings-textarea"
                                rows={12}
                                value={formData.privacy_policy || ''}
                                onChange={(e) => handleChange('privacy_policy', e.target.value)}
                                placeholder={t('settings.privacyPolicyPlaceholder')}
                            />
                        </div>
                        <div className="form-item">
                            <label>{t('settings.termsAndConditions')}</label>
                            <textarea
                                className="settings-textarea"
                                rows={12}
                                value={formData.terms_and_conditions || ''}
                                onChange={(e) => handleChange('terms_and_conditions', e.target.value)}
                                placeholder={t('settings.termsPlaceholder')}
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
                        <p className="settings-hint">{t('settings.expiredCourseReEnrollmentDiscountHint')}</p>
                        <div className="form-item">
                            <label>{t('settings.expiredCourseReEnrollmentDiscountPercent')}</label>
                            <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={formData.expired_course_re_enrollment_discount_percent ?? '0'}
                                onChange={(e) => handleChange('expired_course_re_enrollment_discount_percent', e.target.value)}
                            />
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
