import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ImagePlus } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { teachersAPI } from '../../services/api';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import '../students/StudentForm.css';

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
    bio: '',
    active: true,
  });
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

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
          bio: res.bio || '',
          active: res.active ?? true,
        });
        setExistingImageUrl(res.image_url ? resolveMediaUrl(res.image_url) : null);
      } catch (e) {
        console.error(e);
        setError('فشل تحميل بيانات الأستاذ');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, isEdit]);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const applyImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImageFile(file);
    setImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    applyImageFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    applyImageFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearNewImage = () => {
    setImageFile(null);
    setImagePreview((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const buildFormData = () => {
    const fd = new FormData();
    fd.append('full_name', form.full_name);
    fd.append('email', form.email);
    fd.append('phone', form.phone);
    if (form.bio != null) fd.append('bio', form.bio);
    if (form.password) fd.append('password', form.password);
    fd.append('active', form.active ? '1' : '0');
    if (imageFile) fd.append('image', imageFile);
    return fd;
  };

  const formatApiError = (err) => {
    const data = err.response?.data;
    if (typeof data?.message === 'string') return data.message;
    if (data?.errors && typeof data.errors === 'object') {
      const first = Object.values(data.errors)[0];
      return Array.isArray(first) ? first[0] : String(first);
    }
    return 'فشل حفظ بيانات الأستاذ';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isEdit && !form.password) {
      setError('كلمة المرور مطلوبة عند إنشاء حساب جديد');
      return;
    }
    setLoading(true);
    try {
      const useMultipart = Boolean(imageFile);
      if (useMultipart) {
        const fd = buildFormData();
        if (isEdit) {
          await teachersAPI.update(id, fd);
        } else {
          await teachersAPI.create(fd);
        }
      } else {
        const payload = {
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          bio: form.bio || null,
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
      }
      navigate('/teachers');
    } catch (err) {
      console.error(err);
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const displayImage = imagePreview || existingImageUrl;

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
        <form onSubmit={handleSubmit} className="student-form">
          {error && <div className="student-form-error">{error}</div>}

          <div className="student-form-image-section">
            <span className="student-form-label">صورة الأستاذ</span>
            <div className="student-form-image-row">
              <label
                className={`student-form-image-dropzone ${isDragging ? 'student-form-image-dropzone--drag' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="student-form-image-input"
                  onChange={handleImageChange}
                />
                {displayImage ? (
                  <img src={displayImage} alt="" className="student-form-image-preview" />
                ) : (
                  <div className="student-form-image-placeholder">
                    <ImagePlus size={40} strokeWidth={1.5} aria-hidden />
                    <strong>اختر صورة أو اسحبها هنا</strong>
                    <span className="student-form-image-hint">PNG أو JPG — بحد أقصى 2 ميجابايت</span>
                  </div>
                )}
              </label>
              {imageFile && (
                <div className="student-form-image-actions">
                  <button type="button" className="student-form-remove-image" onClick={clearNewImage}>
                    إلغاء الصورة المختارة
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="student-form-grid">
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

            <div className="student-form-field student-form-span-full">
              <label className="student-form-label" htmlFor="teacher-bio">
                نبذة / السيرة (اختياري)
              </label>
              <textarea
                id="teacher-bio"
                className="student-form-textarea"
                value={form.bio}
                onChange={handleChange('bio')}
                placeholder="معلومات قصيرة عن الأستاذ..."
                rows={5}
              />
            </div>
          </div>

          <div className="student-form-active">
            <input type="checkbox" id="teacher-active" checked={form.active} onChange={handleChange('active')} />
            <label htmlFor="teacher-active" className="student-form-label">
              نشط
            </label>
          </div>

          <div className="student-form-actions">
            <Button type="submit" variant="primary" loading={loading}>
              {isEdit ? t('common.save') : t('common.add')}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/teachers')} disabled={loading}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default TeacherForm;
