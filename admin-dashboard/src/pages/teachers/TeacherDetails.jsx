import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { teachersAPI } from '../../services/api';
import '../students/StudentDetails.css';

const TeacherDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingPerms, setSavingPerms] = useState(false);

  // قائمة الصلاحيات المتاحة للأستاذ
  const availablePermissions = [
    { id: 'create-course', label: 'إنشاء كورس' },
    { id: 'update-course', label: 'تعديل كورس' },
    { id: 'delete-course', label: 'حذف كورس' },
    { id: 'upload-video', label: 'رفع فيديو' },
    { id: 'update-video', label: 'تعديل فيديو' },
    { id: 'delete-video', label: 'حذف فيديو' },
    { id: 'manage-notes', label: 'إدارة النوط والملفات' },
    { id: 'manage-exams', label: 'إدارة الاختبارات' },
    { id: 'manage-chat-groups', label: 'إدارة مجموعات الشات' },
  ];

  const [permissions, setPermissions] = useState([]);

  const loadTeacher = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await teachersAPI.getById(id);
      setTeacher(res);
      const current =
        res.permissions?.map((p) => p.name) ||
        [];
      setPermissions(current);
    } catch (e) {
      console.error(e);
      setError('فشل تحميل بيانات الأستاذ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeacher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const togglePermission = (permId) => {
    setPermissions((prev) =>
      prev.includes(permId)
        ? prev.filter((p) => p !== permId)
        : [...prev, permId],
    );
  };

  const savePermissions = async () => {
    try {
      setSavingPerms(true);
      await teachersAPI.updatePermissions(teacher.id, { permissions });
      await loadTeacher();
    } catch (e) {
      console.error(e);
      alert('فشل حفظ الصلاحيات');
    } finally {
      setSavingPerms(false);
    }
  };

  const toggleSuspend = async () => {
    try {
      await teachersAPI.toggleSuspend(teacher.id);
      await loadTeacher();
    } catch (e) {
      console.error(e);
      alert('فشل تغيير حالة الأستاذ');
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">جاري تحميل بيانات الأستاذ...</div>;
  }

  if (error || !teacher) {
    return <div className="p-6 text-sm text-red-600">{error || 'لم يتم العثور على الأستاذ'}</div>;
  }

  return (
    <div className="students-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('teachers.teacherDetails')}</h1>
          <p className="page-subtitle">{teacher.full_name}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/teachers">
            <Button variant="outline">{t('common.back')}</Button>
          </Link>
          <Button variant="outline" onClick={toggleSuspend}>
            {teacher.active ? 'إيقاف الأستاذ' : 'تفعيل الأستاذ'}
          </Button>
        </div>
      </div>

      <div className="dashboard-grid">
        <Card title={t('teachers.teacherDetails')}>
          <div className="p-4 details-grid">
            <div className="detail-item">
              <span className="detail-label">الاسم الكامل</span>
              <span className="detail-value">{teacher.full_name}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">البريد الإلكتروني</span>
              <span className="detail-value">{teacher.email || '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">رقم الهاتف</span>
              <span className="detail-value">{teacher.phone || '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">الحالة</span>
              <span className={`status-badge status-${teacher.active ? 'active' : 'inactive'}`}>
                {teacher.active ? t('common.active') : t('common.inactive')}
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card title="الكورسات الخاصة بالأستاذ">
        <div className="p-4">
          {!teacher.courses?.length ? (
            <p className="text-sm text-gray-500">لا توجد كورسات.</p>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>العنوان</th>
                    <th>المادة</th>
                    <th>السعر</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {teacher.courses.map((c) => (
                    <tr key={c.id}>
                      <td>{c.title}</td>
                      <td>{c.subject?.name}</td>
                      <td>{c.price}</td>
                      <td>{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card title="صلاحيات الأستاذ">
        <div className="p-4 space-y-3 text-sm">
          <p className="text-gray-600">يمكنك تحديد ما يسمح لهذا الأستاذ بفعله داخل النظام.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {availablePermissions.map((perm) => (
              <label key={perm.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={permissions.includes(perm.id)}
                  onChange={() => togglePermission(perm.id)}
                />
                <span>{perm.label}</span>
              </label>
            ))}
          </div>
          <Button variant="primary" onClick={savePermissions} loading={savingPerms}>
            حفظ الصلاحيات
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default TeacherDetails;

