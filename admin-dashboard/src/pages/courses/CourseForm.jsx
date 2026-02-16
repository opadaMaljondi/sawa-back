import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { coursesAPI, teachersAPI, academicAPI } from '../../services/api';

const CourseForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [instructors, setInstructors] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [form, setForm] = useState({
    instructor_id: '',
    subject_id: '',
    title: '',
    description: '',
    price: '',
    status: 'draft',
    active: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [instRes, subjRes] = await Promise.all([
          teachersAPI.getAll({ page: 1 }),
          academicAPI.getSubjects({ page: 1 }),
        ]);
        setInstructors(instRes.data || []);
        setSubjects(subjRes.data || []);
      } catch (e) {
        console.error(e);
      }
    };
    loadLookups();
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    const loadCourse = async () => {
      try {
        setLoading(true);
        const res = await coursesAPI.getById(id);
        setForm({
          instructor_id: res.instructor_id,
          subject_id: res.subject_id,
          title: res.title,
          description: res.description || '',
          price: res.price ?? '',
          status: res.status,
          active: res.active,
        });
      } catch (e) {
        console.error(e);
        setError('فشل تحميل بيانات الكورس');
      } finally {
        setLoading(false);
      }
    };
    loadCourse();
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
        instructor_id: Number(form.instructor_id),
        subject_id: Number(form.subject_id),
        title: form.title,
        description: form.description,
        price: Number(form.price) || 0,
        status: form.status,
        active: !!form.active,
      };
      if (isEdit) {
        await coursesAPI.update(id, payload);
      } else {
        await coursesAPI.create(payload);
      }
      navigate('/courses');
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'فشل حفظ الكورس');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="students-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isEdit ? t('courses.editCourse') : t('courses.addCourse')}
          </h1>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="text-sm text-red-600 mb-2">{error}</div>}

          {!isEdit && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="input-label">الأستاذ</label>
                <select
                  className="input-field"
                  value={form.instructor_id}
                  onChange={handleChange('instructor_id')}
                  required
                >
                  <option value="">اختر أستاذاً</option>
                  {instructors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.full_name || i.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="input-label">المادة</label>
                <select
                  className="input-field"
                  value={form.subject_id}
                  onChange={handleChange('subject_id')}
                  required
                >
                  <option value="">اختر مادة</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <Input
            label={t('courses.courseName')}
            value={form.title}
            onChange={handleChange('title')}
            required
            fullWidth
          />

          <div>
            <label className="input-label">{t('courses.description')}</label>
            <textarea
              className="input-field"
              rows={3}
              value={form.description}
              onChange={handleChange('description')}
            />
          </div>

          <Input
            label={t('courses.price')}
            type="number"
            value={form.price}
            onChange={handleChange('price')}
            required
            fullWidth
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="input-label">الحالة</label>
              <select
                className="input-field"
                value={form.status}
                onChange={handleChange('status')}
              >
                <option value="draft">مسودة</option>
                <option value="pending">قيد المراجعة</option>
                <option value="published">منشور</option>
              </select>
            </div>
            <div className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={form.active}
                onChange={handleChange('active')}
              />
              <span className="text-sm">نشط</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" variant="primary" loading={loading}>
              {isEdit ? t('common.save') : t('common.add')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/courses')}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CourseForm;

