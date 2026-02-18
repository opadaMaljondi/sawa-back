import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Layers } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import { academicAPI } from '../../services/api';

const SemestersPage = () => {
  const { t } = useTranslation();
  const [semesters, setSemesters] = useState([]);
  const [years, setYears] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingSemester, setEditingSemester] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    year_id: '',
    order: 1,
    active: true
  });

  const fetchSemesters = async (page = 1, year_id = yearFilter) => {
    try {
      setLoading(true);
      setError('');
      const params = { page };
      if (year_id) params.year_id = year_id;
      const res = await academicAPI.getSemesters(params);
      setSemesters(res.data || []);
      setPagination({ current_page: res.current_page, last_page: res.last_page });
    } catch (e) {
      console.error(e);
      setError(t('messages.error') || 'فشل تحميل الفصول');
      setSemesters([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchYears = async () => {
    try {
      const res = await academicAPI.getYears({ per_page: 100 });
      setYears(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchYears();
    fetchSemesters(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChangeYear = (e) => {
    const value = e.target.value;
    setYearFilter(value);
    fetchSemesters(1, value);
  };

  const handleOpenModal = (semester = null) => {
    if (semester) {
      setEditingSemester(semester);
      setFormData({
        name: semester.name || '',
        year_id: semester.year_id || '',
        order: semester.order || 1,
        active: semester.active ?? true
      });
    } else {
      setEditingSemester(null);
      setFormData({
        name: '',
        year_id: yearFilter || '',
        order: 1,
        active: true
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSemester(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingSemester) {
        await academicAPI.updateSemester(editingSemester.id, formData);
      } else {
        await academicAPI.createSemester(formData);
      }
      handleCloseModal();
      fetchSemesters(pagination.current_page);
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
        await academicAPI.deleteSemester(id);
        fetchSemesters(pagination.current_page);
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
          <h1 className="page-title">{t('nav.semesters')}</h1>
          <p className="page-subtitle">{t('academic.semestersSubtitle')}</p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={20} />}
          onClick={() => handleOpenModal()}
        >
          {t('academic.addSemester')}
        </Button>
      </div>

      <Card>
        <div className="table-controls">
          <div style={{ minWidth: 220 }}>
            <label className="input-label">{t('academic.years')}</label>
            <select
              className="input-field"
              value={yearFilter}
              onChange={onChangeYear}
            >
              <option value="">{t('common.all') || 'الكل'}</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} ({y.department?.name})
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
                    <th>{t('academic.semesterName')}</th>
                    <th>{t('academic.years')}</th>
                    <th>{t('academic.departmentOrder')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {semesters.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">
                        <div className="flex items-center gap-2">
                          <Layers size={18} className="text-gray-400" />
                          {s.name}
                        </div>
                      </td>
                      <td>
                        <div>{s.year?.name || '—'}</div>
                        <div className="text-xs text-gray-400">{s.year?.department?.name}</div>
                      </td>
                      <td>{s.order ?? 0}</td>
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
                  onClick={() => fetchSemesters(pagination.current_page - 1)}
                >
                  {t('common.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page >= pagination.last_page}
                  onClick={() => fetchSemesters(pagination.current_page + 1)}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Semester Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingSemester ? t('academic.editSemester') : t('academic.addSemester')}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('academic.semesterName')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="مثال: الفصل الدراسي الأول"
          />

          <div>
            <label className="input-label">{t('academic.years')}</label>
            <select
              className="input-field"
              value={formData.year_id}
              onChange={(e) => setFormData({ ...formData, year_id: e.target.value })}
              required
            >
              <option value="">-- {t('common.select') || 'اختر'} --</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name} ({y.department?.name})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              type="number"
              label={t('academic.departmentOrder')}
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
            />
            <div className="flex items-center h-full pt-6">
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

export default SemestersPage;
