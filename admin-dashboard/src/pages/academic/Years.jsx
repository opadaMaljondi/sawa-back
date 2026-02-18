import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Calendar } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import { academicAPI } from '../../services/api';

const YearsPage = () => {
  const { t } = useTranslation();
  const [years, setYears] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingYear, setEditingYear] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    department_id: '',
    order: 1,
    active: true
  });

  const fetchYears = async (page = 1, department_id = departmentFilter) => {
    try {
      setLoading(true);
      setError('');
      const params = { page };
      if (department_id) params.department_id = department_id;
      const res = await academicAPI.getYears(params);
      setYears(res.data || []);
      setPagination({ current_page: res.current_page, last_page: res.last_page });
    } catch (e) {
      console.error(e);
      setError(t('messages.error') || 'فشل تحميل السنوات');
      setYears([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await academicAPI.getDepartments({ per_page: 100 });
      setDepartments(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDepartments();
    fetchYears(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChangeDepartment = (e) => {
    const value = e.target.value;
    setDepartmentFilter(value);
    fetchYears(1, value);
  };

  const handleOpenModal = (year = null) => {
    if (year) {
      setEditingYear(year);
      setFormData({
        name: year.name || '',
        department_id: year.department_id || '',
        order: year.order || 1,
        active: year.active ?? true
      });
    } else {
      setEditingYear(null);
      setFormData({
        name: '',
        department_id: departmentFilter || '',
        order: 1,
        active: true
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingYear(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingYear) {
        await academicAPI.updateYear(editingYear.id, formData);
      } else {
        await academicAPI.createYear(formData);
      }
      handleCloseModal();
      fetchYears(pagination.current_page);
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
        await academicAPI.deleteYear(id);
        fetchYears(pagination.current_page);
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
          <h1 className="page-title">{t('nav.years')}</h1>
          <p className="page-subtitle">{t('academic.yearsSubtitle')}</p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={20} />}
          onClick={() => handleOpenModal()}
        >
          {t('academic.addYear')}
        </Button>
      </div>

      <Card>
        <div className="table-controls">
          <div style={{ minWidth: 220 }}>
            <label className="input-label">{t('academic.departments')}</label>
            <select
              className="input-field"
              value={departmentFilter}
              onChange={onChangeDepartment}
            >
              <option value="">{t('common.all') || 'الكل'}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
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
                    <th>{t('academic.yearName')}</th>
                    <th>{t('academic.departments')}</th>
                    <th>{t('academic.departmentOrder')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y.id}>
                      <td className="font-medium">
                        <div className="flex items-center gap-2">
                          <Calendar size={18} className="text-gray-400" />
                          {y.name}
                        </div>
                      </td>
                      <td>{y.department?.name || '—'}</td>
                      <td>{y.order ?? 0}</td>
                      <td>
                        <span className={`status-badge ${y.active ? 'status-active' : 'status-inactive'}`}>
                          {y.active ? t('common.active') : t('common.inactive')}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="action-btn edit"
                            title={t('common.edit')}
                            onClick={() => handleOpenModal(y)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="action-btn delete"
                            title={t('common.delete')}
                            onClick={() => handleDelete(y.id)}
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
                  onClick={() => fetchYears(pagination.current_page - 1)}
                >
                  {t('common.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page >= pagination.last_page}
                  onClick={() => fetchYears(pagination.current_page + 1)}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Year Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingYear ? t('academic.editYear') : t('academic.addYear')}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={t('academic.yearName')}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="مثال: الصف الأول الثانوي"
          />

          <div>
            <label className="input-label">{t('academic.departments')}</label>
            <select
              className="input-field"
              value={formData.department_id}
              onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
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

export default YearsPage;
