import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Image as ImageIcon, X, Layout, ExternalLink, GraduationCap, BookOpen, Clock } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import { bannersAPI, coursesAPI, academicAPI, storageURL } from '../../services/api';
import './Banners.css';

const BannersPage = () => {
    const { t } = useTranslation();
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Selectors for linking
    const [courses, setCourses] = useState([]);
    const [subjects, setSubjects] = useState([]);

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [editingBanner, setEditingBanner] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const [file, setFile] = useState(null);

    const [formData, setFormData] = useState({
        title: '',
        link_type: 'none',
        link_id: '',
        link_url: '',
        order: 1,
        active: true
    });

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchBanners();
        fetchLinkOptions();
    }, []);

    const fetchBanners = async () => {
        try {
            setLoading(true);
            const data = await bannersAPI.getAll();
            setBanners(Array.isArray(data) ? data : []);
            setError('');
        } catch (err) {
            console.error('Error fetching banners:', err);
            setError(t('messages.error') || 'فشل تحميل البانرات');
        } finally {
            setLoading(false);
        }
    };

    const fetchLinkOptions = async () => {
        try {
            // Fetch courses and subjects for dropdowns
            const [coursesRes, subjectsRes] = await Promise.all([
                coursesAPI.getAll({ per_page: 100 }),
                academicAPI.getSubjects({ per_page: 100 })
            ]);
            setCourses(coursesRes.data?.data || coursesRes.data || []);
            setSubjects(subjectsRes.data?.data || subjectsRes.data || []);
        } catch (err) {
            console.error('Error fetching link options:', err);
        }
    };

    const handleOpenModal = (banner = null) => {
        if (banner) {
            setEditingBanner(banner);
            setFormData({
                title: banner.title || '',
                link_type: banner.link_type || 'none',
                link_id: banner.link_id || '',
                link_url: banner.link_url || '',
                order: banner.order || 1,
                active: banner.active ?? true
            });
            setPreviewImage(banner.image_path ? (banner.image_path.startsWith('http') ? banner.image_path : `${storageURL}/${banner.image_path}`) : null);
        } else {
            setEditingBanner(null);
            setFormData({
                title: '',
                link_type: 'none',
                link_id: '',
                link_url: '',
                order: banners.length + 1,
                active: true
            });
            setPreviewImage(null);
        }
        setFile(null);
        setShowModal(true);
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setPreviewImage(URL.createObjectURL(selectedFile));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setSubmitting(true);

            const data = new FormData();
            Object.keys(formData).forEach(key => {
                if (formData[key] !== null && formData[key] !== undefined) {
                    data.append(key, formData[key]);
                }
            });

            if (file) {
                data.append('image', file);
            }

            if (editingBanner) {
                await bannersAPI.update(editingBanner.id, data);
            } else {
                await bannersAPI.create(data);
            }

            setShowModal(false);
            fetchBanners();
        } catch (err) {
            console.error('Error saving banner:', err);
            alert(t('messages.error') || 'حدث خطأ أثناء الحفظ');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm(t('messages.confirmDelete') || 'هل أنت متأكد من الحذف؟')) {
            try {
                await bannersAPI.delete(id);
                fetchBanners();
            } catch (err) {
                console.error('Error deleting banner:', err);
                alert(t('messages.error') || 'فشل الحذف');
            }
        }
    };

    const getLinkDisplay = (banner) => {
        if (banner.link_type === 'none') return t('common.none') || 'لا يوجد';
        if (banner.link_type === 'url') return banner.link_url;
        if (banner.link_type === 'course') {
            const course = courses.find(c => c.id == banner.link_id);
            return course ? `${t('nav.courses')}: ${course.title}` : `${t('nav.courses')} (ID: ${banner.link_id})`;
        }
        if (banner.link_type === 'subject') {
            const subject = subjects.find(s => s.id == banner.link_id);
            return subject ? `${t('nav.subjects')}: ${subject.name}` : `${t('nav.subjects')} (ID: ${banner.link_id})`;
        }
        return banner.link_type;
    };

    return (
        <div className="banners-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('banners.title') || 'إدارة البانرات'}</h1>
                    <p className="page-subtitle">{t('banners.subtitle') || 'إدارة الصور الإعلانية في الصفحة الرئيسية للتطبيق'}</p>
                </div>
                <Button
                    variant="primary"
                    icon={<Plus size={20} />}
                    onClick={() => handleOpenModal()}
                >
                    {t('banners.addBanner') || 'إضافة بانر'}
                </Button>
            </div>

            <Card>
                {loading ? (
                    <div className="p-12 text-center text-gray-500">
                        <Clock className="animate-spin mx-auto mb-4" size={32} />
                        {t('common.loading')}
                    </div>
                ) : error ? (
                    <div className="p-12 text-center text-red-600">{error}</div>
                ) : banners.length === 0 ? (
                    <div className="p-12 text-center text-gray-400">
                        <ImageIcon className="mx-auto mb-4 opacity-20" size={48} />
                        <p>{t('messages.noData')}</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t('banners.image') || 'الصورة'}</th>
                                    <th>{t('banners.bannerTitle') || 'العنوان'}</th>
                                    <th>{t('banners.link') || 'الارتباط'}</th>
                                    <th>{t('banners.order') || 'الترتيب'}</th>
                                    <th>{t('common.status')}</th>
                                    <th>{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {banners.map((banner) => (
                                    <tr key={banner.id}>
                                        <td>
                                            <div className="banner-table-img-container">
                                                <img
                                                    src={banner.image_path.startsWith('http') ? banner.image_path : `${storageURL}/${banner.image_path}`}
                                                    alt={banner.title}
                                                    className="banner-table-img"
                                                />
                                            </div>
                                        </td>
                                        <td className="font-semibold">{banner.title || t('common.noTitle') || 'بدون عنوان'}</td>
                                        <td className="text-xs max-w-[200px] truncate">
                                            <div className="banner-link-info">
                                                {banner.link_type === 'url' ? <ExternalLink size={12} /> : banner.link_type === 'course' ? <GraduationCap size={12} /> : banner.link_type === 'subject' ? <BookOpen size={12} /> : null}
                                                {getLinkDisplay(banner)}
                                            </div>
                                        </td>
                                        <td>{banner.order}</td>
                                        <td>
                                            <span className={`status-badge ${banner.active ? 'status-active' : 'status-inactive'}`}>
                                                {banner.active ? t('common.active') : t('common.inactive')}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="table-actions">
                                                <button
                                                    className="action-btn edit"
                                                    title={t('common.edit')}
                                                    onClick={() => handleOpenModal(banner)}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    className="action-btn delete"
                                                    title={t('common.delete')}
                                                    onClick={() => handleDelete(banner.id)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {/* Banner Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingBanner ? (t('banners.editBanner') || 'تعديل البانر') : (t('banners.addBanner') || 'إضافة بانر جديد')}
                size="md"
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Image Upload Area */}
                    <div
                        className="banner-upload-area"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {previewImage ? (
                            <>
                                <img src={previewImage} alt="Preview" className="banner-upload-preview" />
                                <div className="banner-upload-overlay">
                                    <div className="bg-white/20 backdrop-blur-md p-2 rounded-full text-white">
                                        <Plus size={24} />
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="banner-upload-placeholder">
                                <ImageIcon size={48} strokeWidth={1} />
                                <span>{t('academic.uploadIcon') || 'اختر صورة'}</span>
                            </div>
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                            accept="image/*"
                        />
                    </div>

                    <Input
                        label={t('banners.bannerTitle') || 'عنوان البانر'}
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder={t('banners.titlePlaceholder') || 'مثال: خصم خاص 50%'}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="settings-label-with-icon">
                                <Layout size={16} />
                                {t('banners.linkType') || 'نوع الارتباط'}
                            </label>
                            <select
                                className="input-field"
                                value={formData.link_type}
                                onChange={(e) => setFormData({ ...formData, link_type: e.target.value, link_id: '', link_url: '' })}
                            >
                                <option value="none">{t('common.none')}</option>
                                <option value="course">{t('nav.courses')}</option>
                                <option value="subject">{t('nav.subjects')}</option>
                                <option value="url">{t('banners.externalLink') || 'رابط خارجي'}</option>
                            </select>
                        </div>

                        {formData.link_type === 'url' ? (
                            <Input
                                label={t('banners.externalUrl') || 'الرابط'}
                                value={formData.link_url}
                                onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                                placeholder="https://..."
                            />
                        ) : formData.link_type === 'course' ? (
                            <div>
                                <label className="settings-label-with-icon">{t('nav.courses')}</label>
                                <select
                                    className="input-field"
                                    value={formData.link_id}
                                    onChange={(e) => setFormData({ ...formData, link_id: e.target.value })}
                                    required
                                >
                                    <option value="">-- {t('common.select')} --</option>
                                    {courses.map(c => (
                                        <option key={c.id} value={c.id}>{c.title}</option>
                                    ))}
                                </select>
                            </div>
                        ) : formData.link_type === 'subject' ? (
                            <div>
                                <label className="settings-label-with-icon">{t('nav.subjects')}</label>
                                <select
                                    className="input-field"
                                    value={formData.link_id}
                                    onChange={(e) => setFormData({ ...formData, link_id: e.target.value })}
                                    required
                                >
                                    <option value="">-- {t('common.select')} --</option>
                                    {subjects.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <Input
                                type="number"
                                label={t('banners.order') || 'الترتيب'}
                                value={formData.order}
                                onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                            />
                        )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                        <input
                            type="checkbox"
                            id="banner-active"
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={formData.active}
                            onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                        />
                        <label htmlFor="banner-active" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                            {t('common.active')}
                        </label>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setShowModal(false)}
                            type="button"
                        >
                            {t('common.cancel')}
                        </Button>
                        <Button
                            variant="primary"
                            type="submit"
                            disabled={submitting || (!file && !editingBanner)}
                            loading={submitting}
                        >
                            {t('common.save')}
                        </Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default BannersPage;
