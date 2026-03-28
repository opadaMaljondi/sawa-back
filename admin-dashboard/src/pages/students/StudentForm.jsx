import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ImagePlus } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { studentsAPI, academicAPI } from '../../services/api';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import './StudentForm.css';

const StudentForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    department_id: '',
    year_id: '',
    active: true,
  });
  const [departments, setDepartments] = useState([]);
  const [years, setYears] = useState([]);
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await academicAPI.getDepartments({ per_page: 500 });
        setDepartments(res.data || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingLists(false);
      }
    };
    loadDepartments();
  }, []);

  const fetchYears = async (departmentId) => {
    try {
      const params = { per_page: 500, active: true };
      if (departmentId) params.department_id = departmentId;
      const res = await academicAPI.getYears(params);
      setYears(res.data || []);
    } catch (e) {
      console.error(e);
      setYears([]);
    }
  };

  useEffect(() => {
    if (!form.department_id) {
      setYears([]);
      return;
    }
    fetchYears(form.department_id);
  }, [form.department_id]);

  useEffect(() => {
    if (!isEdit) return;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await studentsAPI.getById(id);
        const deptId = res.department_id != null ? String(res.department_id) : '';
        setForm({
          full_name: res.full_name || '',
          email: res.email || '',
          phone: res.phone || '',
          password: '',
          department_id: deptId,
          year_id: res.year_id != null ? String(res.year_id) : '',
          active: res.active ?? true,
        });
        setExistingImageUrl(res.image_url ? resolveMediaUrl(res.image_url) : null);
        if (deptId) {
          await fetchYears(deptId);
        }
      } catch (e) {
        console.error(e);
        setError('فشل تحميل بيانات الطالب');
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
    if (field === 'department_id') {
      setForm((f) => ({ ...f, department_id: value, year_id: '' }));
      return;
    }
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
    if (form.phone.trim()) fd.append('phone', form.phone.trim());
    if (form.password) fd.append('password', form.password);
    if (form.department_id) fd.append('department_id', form.department_id);
    if (form.year_id) fd.append('year_id', form.year_id);
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
    return 'فشل حفظ بيانات الطالب';
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
          await studentsAPI.update(id, fd);
        } else {
          await studentsAPI.create(fd);
        }
      } else {
        const payload = {
          full_name: form.full_name,
          email: form.email,
          phone: form.phone.trim() || null,
          active: !!form.active,
          department_id: form.department_id ? Number(form.department_id) : null,
          year_id: form.year_id ? Number(form.year_id) : null,
        };
        if (!isEdit || form.password) {
          payload.password = form.password;
        }
        if (isEdit) {
          await studentsAPI.update(id, payload);
        } else {
          await studentsAPI.create(payload);
        }
      }
      navigate('/students');
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
            {isEdit ? t('students.editStudent') : t('students.addStudent')}
          </h1>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="student-form">
          {error && <div className="student-form-error">{error}</div>}

          <div className="student-form-image-section">
            <span className="student-form-label">صورة الطالب</span>
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
                  <button
                    type="button"
                    className="student-form-remove-image"
                    onClick={clearNewImage}
                  >
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
              label="رقم الهاتف (اختياري)"
              value={form.phone}
              onChange={handleChange('phone')}
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

            <div className="student-form-field">
              <label className="student-form-label" htmlFor="student-department">
                القسم
              </label>
              <select
                id="student-department"
                className="student-form-select"
                value={form.department_id}
                onChange={handleChange('department_id')}
                disabled={loadingLists}
              >
                <option value="">— بدون —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="student-form-field">
              <label className="student-form-label" htmlFor="student-year">
                السنة الدراسية
              </label>
              <select
                id="student-year"
                className="student-form-select"
                value={form.year_id}
                onChange={handleChange('year_id')}
                disabled={!form.department_id}
              >
                <option value="">— بدون —</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
              {!form.department_id && (
                <p className="student-form-helper">اختر القسم أولاً لعرض السنوات</p>
              )}
            </div>
          </div>

          <div className="student-form-active">
            <input
              type="checkbox"
              id="student-active"
              checked={form.active}
              onChange={handleChange('active')}
            />
            <label htmlFor="student-active" className="student-form-label">
              نشط
            </label>
          </div>

          <div className="student-form-actions">
            <Button type="submit" variant="primary" loading={loading}>
              {isEdit ? t('common.save') : t('common.add')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/students')}
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

export default StudentForm;
