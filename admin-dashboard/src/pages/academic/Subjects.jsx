import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, BookOpen } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import { academicAPI } from '../../services/api';

const SubjectsPage = () => {
  const { t } = useTranslation();
  const [subjects, setSubjects] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [years, setYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ department_id: '', year_id: '', semester_id: '' });

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    department_id: '',
    year_id: '',
    semester_id: '',
    active: true
  });

  // Modal Dropdowns State
  const [modalYears, setModalYears] = useState([]);
  const [modalSemesters, setModalSemesters] = useState([]);

  const fetchSubjects = async (page = 1, f = filters) => {
    try {
      setLoading(true);
      setError('');
      const params = { page };
      if (f.department_id) params.department_id = f.department_id;
      if (f.year_id) params.year_id = f.year_id;
      if (f.semester_id) params.semester_id = f.semester_id;
      const res = await academicAPI.getSubjects(params);
      setSubjects(res.data || []);
      setPagination({ current_page: res.current_page, last_page: res.last_page });
    } catch (e) {
      console.error(e);
      setError(t('messages.error') || 'فشل تحميل المواد');
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    academicAPI
      .getDepartments({ per_page: 100 })
      .then((res) => setDepartments(res.data || []))
      .catch(() => setDepartments([]));
    fetchSubjects(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDepartmentChange = async (e) => {
    const department_id = e.target.value;
    const next = { department_id, year_id: '', semester_id: '' };
    setFilters(next);
    if (department_id) {
      const resYears = await academicAPI.getYears({ department_id, per_page: 100 }).catch(() => null);
      setYears(resYears?.data || []);
      setSemesters([]);
    } else {
      setYears([]);
      setSemesters([]);
    }
    fetchSubjects(1, next);
  };

  const handleYearChange = async (e) => {
    const year_id = e.target.value;
    const next = { ...filters, year_id, semester_id: '' };
    setFilters(next);
    if (year_id) {
      const resSem = await academicAPI.getSemesters({ year_id, per_page: 100 }).catch(() => null);
      setSemesters(resSem?.data || []);
    } else {
      setSemesters([]);
    }
    fetchSubjects(1, next);
  };

  const handleSemesterChange = (e) => {
    const semester_id = e.target.value;
    const next = { ...filters, semester_id };
    setFilters(next);
    fetchSubjects(1, next);
  };

  // Modal Cascading logic
  const handleModalDepartmentChange = async (e) => {
    const department_id = e.target.value;
    setFormData({ ...formData, department_id, year_id: '', semester_id: '' });
    if (department_id) {
      const resYears = await academicAPI.getYears({ department_id, per_page: 100 }).catch(() => null);
      setModalYears(resYears?.data || []);
      setModalSemesters([]);
    } else {
      setModalYears([]);
      setModalSemesters([]);
    }
  };

  const handleModalYearChange = async (e) => {
    const year_id = e.target.value;
    setFormData({ ...formData, year_id, semester_id: '' });
    if (year_id) {
      const resSem = await academicAPI.getSemesters({ year_id, per_page: 100 }).catch(() => null);
      setModalSemesters(resSem?.data || []);
    } else {
      setModalSemesters([]);
    }
  };

  const handleOpenModal = async (subject = null) => {
    if (subject) {
      setEditingSubject(subject);
      setFormData({
        name: subject.name || '',
        slug: subject.slug || '',
        description: subject.description || '',
        department_id: subject.department_id || '',
        year_id: subject.year_id || '',
        semester_id: subject.semester_id || '',
        active: subject.active ?? true
      });

      // Load years and semesters for editing
      if (subject.department_id) {
        const resYears = await academicAPI.getYears({ department_id: subject.department_id, per_page: 100 }).catch(() => null);
        setModalYears(resYears?.data || []);
      }
      if (subject.year_id) {
        const resSem = await academicAPI.getSemesters({ year_id: subject.year_id, per_page: 100 }).catch(() => null);
        setModalSemesters(resSem?.data || []);
      }
    } else {
      setEditingSubject(null);
      setFormData({
        name: '',
        slug: '',
        description: '',
        department_id: filters.department_id || '',
        year_id: filters.year_id || '',
        semester_id: filters.semester_id || '',
        active: true
      });
      // Auto-load dropdowns if filters are present
      if (filters.department_id) {
        const resYears = await academicAPI.getYears({ department_id: filters.department_id, per_page: 100 }).catch(() => null);
        setModalYears(resYears?.data || []);
      }
      if (filters.year_id) {
        const resSem = await academicAPI.getSemesters({ year_id: filters.year_id, per_page: 100 }).catch(() => null);
        setModalSemesters(resSem?.data || []);
      }
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSubject(null);
    setModalYears([]);
    setModalSemesters([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingSubject) {
        await academicAPI.updateSubject(editingSubject.id, formData);
      } else {
        await academicAPI.createSubject(formData);
      }
      handleCloseModal();
      fetchSubjects(pagination.current_page);
    } catch (err) {
      console.error(err);
      alert(t('messages.error') || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('messages.confirmDelete') || 'هل أنت متأكد من الحذف؟')) {
      try {
        await academicAPI.deleteSubject(id);
        fetchSubjects(pagination.current_page);
      } catch (err) {
        console.error(err);
        alert(t('messages.error') || 'فشل الحذف');
      }
    }
  };

  return (
    <div className="students-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.subjects')}</h1>
          <p className="page-subtitle">{t('academic.subjectsSubtitle')}</p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={20} />}
          onClick={() => handleOpenModal()}
        >
          {t('academic.addSubject')}
        </Button>
      </div>

      <Card>
        <div className="table-controls" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 180 }}>
            <label className="input-label">{t('academic.departments')}</label>
            <select
              className="input-field"
              value={filters.department_id}
              onChange={handleDepartmentChange}
            >
              <option value="">{t('common.all') || 'الكل'}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 180 }}>
            <label className="input-label">{t('academic.years')}</label>
            <select
              className="input-field"
              value={filters.year_id}
              onChange={handleYearChange}
              disabled={!years.length}
            >
              <option value="">{t('common.all') || 'الكل'}</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 180 }}>
            <label className="input-label">{t('academic.semesters')}</label>
            <select
              className="input-field"
              value={filters.semester_id}
              onChange={handleSemesterChange}
              disabled={!semesters.length}
            >
              <option value="">{t('common.all') || 'الكل'}</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500">{t('common.loading')}</div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-red-600">{error}</div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('academic.subjectName')}</th>
                    <th>{t('academic.departments')}</th>
                    <th>{t('academic.years')}</th>
                    <th>{t('academic.semesters')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">
                        <div className="flex items-center gap-2">
                          <BookOpen size={18} className="text-gray-400" />
                          <div>
                            <div>{s.name}</div>
                            <div className="text-xs text-gray-400">{s.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td>{s.department?.name || '—'}</td>
                      <td>{s.year?.name || '—'}</td>
                      <td>{s.semester?.name || '—'}</td>
                      <td>
                        <span className={`status-badge ${s.active ? 'status-active' : 'status-inactive'}`}>
                          {s.active ? t('common.active') : t('common.inactive')}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="action-btn edit"
                            title={t('common.edit')}
                            onClick={() => handleOpenModal(s)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="action-btn delete"
                            title={t('common.delete')}
                            onClick={() => handleDelete(s.id)}
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

            <div className="table-pagination">
              <p className="pagination-info">
                صفحة {pagination.current_page} من {pagination.last_page}
              </p>
              <div className="pagination-controls">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page <= 1}
                  onClick={() => fetchSubjects(pagination.current_page - 1)}
                >
                  {t('common.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page >= pagination.last_page}
                  onClick={() => fetchSubjects(pagination.current_page + 1)}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Subject Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingSubject ? t('academic.editSubject') : t('academic.addSubject')}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('academic.subjectName')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="أتركه فارغاً للتوليد التلقائي"
            />
          </div>

          <div>
            <label className="input-label">{t('academic.departments')}</label>
            <select
              className="input-field"
              value={formData.department_id}
              onChange={handleModalDepartmentChange}
              required
            >
              <option value="">-- {t('common.select') || 'اختر'} --</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="input-label">{t('academic.years')}</label>
              <select
                className="input-field"
                value={formData.year_id}
                onChange={handleModalYearChange}
                required
                disabled={!modalYears.length}
              >
                <option value="">-- {t('common.select') || 'اختر'} --</option>
                {modalYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">{t('academic.semesters')}</label>
              <select
                className="input-field"
                value={formData.semester_id}
                onChange={(e) => setFormData({ ...formData, semester_id: e.target.value })}
                required
                disabled={!modalSemesters.length}
              >
                <option value="">-- {t('common.select') || 'اختر'} --</option>
                {modalSemesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label={t('academic.subjectDescription')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            textarea
          />

          <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              />
              <span className="mr-2 ml-2 text-sm text-gray-700">{t('academic.departmentActive')}</span>
            </label>
          </div>

          <div className="modal-footer px-0 pb-0">
            <Button variant="outline" type="button" onClick={handleCloseModal}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" type="submit" loading={submitting}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SubjectsPage;
