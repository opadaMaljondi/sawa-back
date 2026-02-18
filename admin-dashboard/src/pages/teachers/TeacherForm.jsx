import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { teachersAPI } from '../../services/api';

const TeacherForm = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const isEdit = Boolean(id);

    const [form, setForm] = useState({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        active: true,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isEdit) return;
        const load = async () => {
            try {
                setLoading(true);
                setError('');
                const res = await teachersAPI.getById(id);
                setForm({
                    full_name: res.full_name || '',
                    email: res.email || '',
                    phone: res.phone || '',
                    password: '',
                    active: res.active ?? true,
                });
            } catch (e) {
                console.error(e);
                setError('فشل تحميل بيانات الأستاذ');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, isEdit]);

    const handleChange = (field) => (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setForm((f) => ({ ...f, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const payload = {
                full_name: form.full_name,
                email: form.email,
                phone: form.phone,
                active: !!form.active,
            };
            if (!isEdit || form.password) {
                payload.password = form.password;
            }
            if (isEdit) {
                await teachersAPI.update(id, payload);
            } else {
                await teachersAPI.create(payload);
            }
            navigate('/teachers');
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'فشل حفظ بيانات الأستاذ');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="students-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">
                        {isEdit ? t('teachers.editTeacher') : t('teachers.addTeacher')}
                    </h1>
                </div>
            </div>

            <Card>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

                    <Input
                        label="الاسم الكامل"
                        value={form.full_name}
                        onChange={handleChange('full_name')}
                        required
                        fullWidth
                    />
                    <Input
                        label="البريد الإلكتروني"
                        type="email"
                        value={form.email}
                        onChange={handleChange('email')}
                        required
                        fullWidth
                    />
                    <Input
                        label="رقم الهاتف"
                        value={form.phone}
                        onChange={handleChange('phone')}
                        required
                        fullWidth
                    />
                    <Input
                        label={isEdit ? 'كلمة المرور (اتركها فارغة لعدم التغيير)' : 'كلمة المرور'}
                        type="password"
                        value={form.password}
                        onChange={handleChange('password')}
                        required={!isEdit}
                        fullWidth
                    />

                    <div className="flex items-center gap-2 mt-2">
                        <input
                            type="checkbox"
                            checked={form.active}
                            onChange={handleChange('active')}
                        />
                        <span className="text-sm">نشط</span>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button type="submit" variant="primary" loading={loading}>
                            {isEdit ? t('common.save') : t('common.add')}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => navigate('/teachers')}
                            disabled={loading}
                        >
                            {t('common.cancel')}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default TeacherForm;
