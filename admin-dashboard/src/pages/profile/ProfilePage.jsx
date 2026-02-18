import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Mail, Phone, Lock, Save, Loader2, Camera } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { adminAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import './ProfilePage.css';

const ProfilePage = () => {
    const { t } = useTranslation();
    const { user, updateUser } = useAuth();
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        password_confirmation: ''
    });
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    
    const storageURL = import.meta.env.VITE_STORAGE_URL || 'http://localhost:8000/storage';

    useEffect(() => {
        if (user) {
            setFormData({
                full_name: user.full_name || '',
                email: user.email || '',
                phone: user.phone || '',
                password: '',
                password_confirmation: ''
            });
            if (user.image) {
                setImagePreview(`${storageURL}/${user.image}`);
            }
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            setMessage({ type: '', text: '' });

            const data = new FormData();
            data.append('full_name', formData.full_name);
            data.append('email', formData.email);
            data.append('phone', formData.phone);

            if (formData.password) {
                data.append('password', formData.password);
                data.append('password_confirmation', formData.password_confirmation);
            }

            if (image) {
                data.append('image', image);
            }

            const res = await adminAPI.updateProfile(data);
            updateUser(res.user);
            setMessage({ type: 'success', text: t('messages.updateSuccess') });

            // Clear passwords
            setFormData(prev => ({ ...prev, password: '', password_confirmation: '' }));
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.message || t('messages.error');
            setMessage({ type: 'error', text: errorMsg });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="profile-page">
            <div className="page-header">
                <h1 className="page-title">{t('common.profile')}</h1>
                <p className="page-subtitle">إدارة معلوماتك الشخصية وإعدادات الأمان</p>
            </div>

            <div className="profile-grid">
                <Card className="profile-card main-info">
                    <form onSubmit={handleSubmit}>
                        <div className="avatar-upload-section">
                            <div className="avatar-preview">
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Profile" />
                                ) : (
                                    <div className="avatar-placeholder">
                                        <User size={40} />
                                    </div>
                                )}
                                <label className="avatar-edit-btn">
                                    <Camera size={16} />
                                    <input type="file" hidden onChange={handleImageChange} accept="image/*" />
                                </label>
                            </div>
                            <div className="avatar-info">
                                <h3>{formData.full_name || 'Admin'}</h3>
                                <p>{formData.email}</p>
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label>{t('students.firstName')} / {t('students.lastName')}</label>
                                <Input
                                    name="full_name"
                                    value={formData.full_name}
                                    onChange={handleChange}
                                    icon={<User size={18} />}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>{t('common.email')}</label>
                                <Input
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    icon={<Mail size={18} />}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>{t('common.phone')}</label>
                                <Input
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    icon={<Phone size={18} />}
                                    required
                                />
                            </div>
                        </div>

                        <hr className="divider" />

                        <h4 className="section-title">تغيير كلمة المرور</h4>
                        <div className="form-grid">
                            <div className="form-group">
                                <label>كلمة المرور الجديدة</label>
                                <Input
                                    name="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    icon={<Lock size={18} />}
                                    placeholder="اتركه فارغاً للحفاظ على الحالية"
                                />
                            </div>

                            <div className="form-group">
                                <label>تأكيد كلمة المرور</label>
                                <Input
                                    name="password_confirmation"
                                    type="password"
                                    value={formData.password_confirmation}
                                    onChange={handleChange}
                                    icon={<Lock size={18} />}
                                />
                            </div>
                        </div>

                        <div className="profile-footer">
                            {message.text && (
                                <div className={`message-alert ${message.type}`}>
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
                </Card>

                <Card className="profile-card stats-card">
                    <h4 className="section-title">معلومات الحساب</h4>
                    <div className="account-info-list">
                        <div className="info-item">
                            <span className="info-label">نوع الحساب:</span>
                            <span className="info-value badge admin">مدير النظام</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">حالة الحساب:</span>
                            <span className="info-value badge active">نشط</span>
                        </div>
                        <div className="info-item">
                            <span className="info-label">آخر تسجيل دخول:</span>
                            <span className="info-value">اليوم، 10:30 صباحاً</span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default ProfilePage;
