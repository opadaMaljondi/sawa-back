import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Edit2, Trash2, Image as ImageIcon, X, Eye, ChevronDown, ChevronRight, Book, GraduationCap, Calendar } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import { academicAPI, storageURL } from '../../services/api';

const getFullUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  // If path starts with /storage, we might need to handle it differently depending on what dep.icon_url returns
  // According to tinker, it returns /storage/departments/...
  // So if cleanPath starts with /storage, we just prepend the host (which is in storageURL but storageURL already has /storage)
  if (cleanPath.startsWith('/storage')) {
    const host = storageURL.replace(/\/storage$/, '');
    return `${host}${cleanPath}`;
  }
  return `${storageURL}${cleanPath}`;
};

const DepartmentsPage = () => {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const fileInputRef = useRef(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    name_en: '',
    description: '',
    icon: null, // This will hold the file object
    color: '#4f46e5',
    order: 0,
    active: true
  });
  const [iconPreview, setIconPreview] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  // Details Modal State
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedDepartmentRef, setSelectedDepartmentRef] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [expandedYears, setExpandedYears] = useState({});
  const [expandedSemesters, setExpandedSemesters] = useState({});

  const fetchDepartments = async (page = 1) => {
    try {
      setLoading(true);
      setError('');
      const res = await academicAPI.getDepartments({ page });
      setDepartments(res.data || []);
      setPagination({ current_page: res.current_page, last_page: res.last_page });
    } catch (e) {
      console.error(e);
      setError(t('messages.error') || 'فشل تحميل الأقسام');
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenModal = (dep = null) => {
    if (dep) {
      setEditingDepartment(dep);
      setFormData({
        name: dep.name || '',
        name_en: dep.name_en || '',
        description: dep.description || '',
        icon: null,
        color: dep.color || '#4f46e5',
        order: dep.order || 0,
        active: dep.active ?? true
      });
      setIconPreview(getFullUrl(dep.icon_url));
    } else {
      setEditingDepartment(null);
      setFormData({
        name: '',
        name_en: '',
        description: '',
        icon: null,
        color: '#4f46e5',
        order: 0,
        active: true
      });
      setIconPreview(null);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDepartment(null);
    setIconPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({ ...formData, icon: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setIconPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);

      const data = new FormData();
      data.append('name', formData.name);
      data.append('name_en', formData.name_en);
      data.append('description', formData.description);
      data.append('color', formData.color);
      data.append('order', formData.order);
      data.append('active', formData.active ? '1' : '0');

      if (formData.icon) {
        data.append('icon', formData.icon);
      }

      if (editingDepartment) {
        // Laravel workaround for PUT with files: use POST and append _method=PUT
        data.append('_method', 'PUT');
        await academicAPI.updateDepartment(editingDepartment.id, data);
      } else {
        await academicAPI.createDepartment(data);
      }

      handleCloseModal();
      fetchDepartments(pagination.current_page);
    } catch (err) {
      console.error(err);
      alert(t('messages.error') || 'حدث خطأ أثناء الحفظ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('academic.confirmDeleteDepartment') || 'هل أنت متأكد من الحذف؟')) {
      try {
        await academicAPI.deleteDepartment(id);
        fetchDepartments(pagination.current_page);
      } catch (err) {
        console.error(err);
        alert(t('messages.error') || 'فشل الحذف');
      }
    }
  };

  const handleOpenDetails = async (id) => {
    try {
      setDetailsLoading(true);
      setShowDetailsModal(true);
      const res = await academicAPI.getDepartmentById(id);
      setSelectedDepartmentRef(res);
    } catch (err) {
      console.error(err);
      alert(t('messages.error') || 'فشل جلب التفاصيل');
      setShowDetailsModal(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const toggleYear = (yearId) => {
    setExpandedYears(prev => ({ ...prev, [yearId]: !prev[yearId] }));
  };

  const toggleSemester = (semId) => {
    setExpandedSemesters(prev => ({ ...prev, [semId]: !prev[semId] }));
  };

  const filtered = search
    ? departments.filter((d) =>
      (d.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.name_en || '').toLowerCase().includes(search.toLowerCase())
    )
    : departments;

  return (
    <div className="students-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.departments')}</h1>
          <p className="page-subtitle">{t('academic.departmentsSubtitle')}</p>
        </div>
        <Button
          variant="primary"
          icon={<Plus size={20} />}
          onClick={() => handleOpenModal()}
        >
          {t('academic.addDepartment')}
        </Button>
      </div>

      <Card>
        <div className="table-controls">
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
          />
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
                    <th>{t('academic.departmentName')}</th>
                    <th>{t('academic.departmentDescription')}</th>
                    <th>{t('academic.departmentOrder')}</th>
                    <th>{t('common.status')}</th>
                    <th>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((dep) => (
                    <tr key={dep.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center overflow-hidden bg-gray-100 cursor-zoom-in group relative shadow-sm hover:shadow-md transition-all border border-gray-200"
                            style={{
                              width: '32px',
                              height: '32px',
                              minWidth: '32px',
                              minHeight: '32px',
                              borderColor: dep.color || '#4f46e5'
                            }}
                            onClick={() => setPreviewImage(getFullUrl(dep.icon_url))}
                            title={t('common.preview')}
                          >
                            {dep.icon_url ? (
                              <img src={getFullUrl(dep.icon_url)} alt={dep.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            ) : (
                              <ImageIcon size={20} className="text-gray-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{dep.name}</div>
                            <div className="text-xs text-gray-400">{dep.name_en}</div>
                          </div>
                        </div>
                      </td>
                      <td>{dep.description || '—'}</td>
                      <td>{dep.order ?? 0}</td>
                      <td>
                        <span className={`status-badge ${dep.active ? 'status-active' : 'status-inactive'}`}>
                          {dep.active ? t('common.active') : t('common.inactive')}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="action-btn view"
                            title={t('common.view')}
                            onClick={() => handleOpenDetails(dep.id)}
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            className="action-btn edit"
                            title={t('common.edit')}
                            onClick={() => handleOpenModal(dep)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="action-btn delete"
                            title={t('common.delete')}
                            onClick={() => handleDelete(dep.id)}
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
                {t('common.previous')} {pagination.current_page} {t('common.next')} {pagination.last_page}
              </p>
              <div className="pagination-controls">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page <= 1}
                  onClick={() => fetchDepartments(pagination.current_page - 1)}
                >
                  {t('common.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page >= pagination.last_page}
                  onClick={() => fetchDepartments(pagination.current_page + 1)}
                >
                  {t('common.next')}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Department Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingDepartment ? t('academic.editDepartment') : t('academic.addDepartment')}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-300 overflow-hidden bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                style={{ borderColor: formData.color }}
              >
                {iconPreview ? (
                  <img src={iconPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <ImageIcon size={32} className="mx-auto text-gray-400 mb-1" />
                    <span className="text-[10px] text-gray-500 block">{t('academic.uploadIcon') || 'رفع أيقونة'}</span>
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
              {iconPreview && (
                <button
                  type="button"
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600"
                  onClick={() => {
                    setIconPreview(null);
                    setFormData({ ...formData, icon: null });
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t('academic.departmentName')}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label={t('academic.departmentNameEn')}
              value={formData.name_en}
              onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
            />
          </div>

          <Input
            label={t('academic.departmentDescription')}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            textarea
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="input-label">{t('academic.departmentColor')}</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  className="h-10 w-20 rounded border border-gray-200 cursor-pointer"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
                <input
                  type="text"
                  className="input-field flex-1"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                />
              </div>
            </div>
            <Input
              type="number"
              label={t('academic.departmentOrder')}
              value={formData.order}
              onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
            />
          </div>

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

      {/* Full Size Image Preview Modal */}
      <Modal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        title={t('common.preview') || 'معاينة'}
        size="md"
      >
        <div className="flex justify-center p-2">
          {previewImage && (
            <img
              src={previewImage}
              alt="Full Preview"
              className="max-w-full max-h-[70vh] rounded-lg shadow-xl object-contain"
            />
          )}
        </div>
        <div className="modal-footer px-0 pb-0 mt-4">
          <Button variant="outline" onClick={() => setPreviewImage(null)} fullWidth>
            {t('common.close')}
          </Button>
        </div>
      </Modal>

      {/* Department Details Modal (Nested Structure) */}
      {/* Department Details Modal (Nested Structure) */}
      {/* Department Details Modal (Nested Structure) */}
      <Modal
        isOpen={showDetailsModal}
        onClose={() => {
          setShowDetailsModal(false);
          setSelectedDepartmentRef(null);
          setExpandedYears({});
          setExpandedSemesters({});
        }}
        title={selectedDepartmentRef ? `${t('academic.departmentDetails') || 'تفاصيل الهيكل'}: ${selectedDepartmentRef.name}` : t('common.loading')}
        size="lg"
      >
        {detailsLoading ? (
          <div className="flex flex-col items-center justify-center p-20 space-y-4">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="text-gray-400 animate-pulse">{t('common.loading')}</p>
          </div>
        ) : selectedDepartmentRef ? (
          <div className="flex flex-col gap-6" dir="rtl">
            {/* Elegant Header Card */}
            <div className="relative p-6 rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
              {/* Decorative background accent */}
              <div
                className="absolute top-0 right-0 w-1/3 h-full opacity-[0.03] transition-opacity"
                style={{ backgroundColor: selectedDepartmentRef.color }}
              ></div>

              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-inner border border-gray-50"
                    style={{ backgroundColor: selectedDepartmentRef.color + '10' }}
                  >
                    {selectedDepartmentRef.icon_url ? (
                      <img src={getFullUrl(selectedDepartmentRef.icon_url)} className="w-12 h-12 object-contain" alt="" />
                    ) : (
                      <GraduationCap size={40} style={{ color: selectedDepartmentRef.color }} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{selectedDepartmentRef.name}</h3>
                    <p className="text-gray-500 font-medium">{selectedDepartmentRef.name_en}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${selectedDepartmentRef.active ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {selectedDepartmentRef.active ? t('common.active') : t('common.inactive')}
                      </span>
                      <span className="text-xs text-gray-400">|</span>
                      <span className="text-xs font-semibold text-gray-500">
                        {selectedDepartmentRef.years?.length || 0} {t('academic.years')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Academic Structure Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-5 bg-primary rounded-full"></div>
                <h4 className="text-sm font-bold text-gray-700">{t('academic.years') || 'الخطة الدراسية'}</h4>
              </div>

              {selectedDepartmentRef.years?.length > 0 ? (
                <div className="space-y-3">
                  {selectedDepartmentRef.years.map((year) => (
                    <div
                      key={year.id}
                      className={`border rounded-xl transition-all duration-300 ${expandedYears[year.id] ? 'bg-white shadow-md border-gray-200' : 'bg-gray-50/50 border-gray-100 hover:bg-gray-50'}`}
                    >
                      <button
                        type="button"
                        className="w-full flex items-center justify-between p-4 outline-none"
                        onClick={() => toggleYear(year.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${expandedYears[year.id] ? 'bg-primary text-white shadow-sm' : 'bg-white text-gray-400 border border-gray-100'}`}>
                            <Calendar size={20} />
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-gray-800 block">{year.name}</span>
                            <span className="text-[10px] text-gray-400 font-medium">{year.semesters?.length || 0} {t('academic.semesters')}</span>
                          </div>
                        </div>
                        <ChevronDown size={20} className={`text-gray-300 transition-transform duration-300 ${expandedYears[year.id] ? 'rotate-180' : ''}`} />
                      </button>

                      {expandedYears[year.id] && (
                        <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="border-t border-gray-100 pt-4 space-y-3">
                            {year.semesters?.length > 0 ? (
                              year.semesters.map((sem) => (
                                <div key={sem.id} className="bg-gray-50/50 rounded-xl border border-gray-100/50 overflow-hidden">
                                  <button
                                    type="button"
                                    className="w-full flex items-center justify-between p-3 hover:bg-white transition-colors"
                                    onClick={() => toggleSemester(sem.id)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${expandedSemesters[sem.id] ? 'bg-amber-500 text-white' : 'bg-white text-amber-500 border border-amber-100'}`}>
                                        <Book size={16} />
                                      </div>
                                      <span className="text-sm font-bold text-gray-700">{sem.name}</span>
                                    </div>
                                    <ChevronRight size={16} className={`text-gray-300 transition-transform duration-300 ${expandedSemesters[sem.id] ? 'rotate-90' : ''}`} />
                                  </button>

                                  {expandedSemesters[sem.id] && (
                                    <div className="p-3 bg-white border-t border-gray-100/50 animate-in fade-in duration-200">
                                      {sem.subjects?.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                          {sem.subjects.map((sub) => (
                                            <div
                                              key={sub.id}
                                              className="px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-600 font-medium hover:bg-white hover:border-primary/30 hover:text-primary transition-all cursor-default flex items-center gap-2"
                                            >
                                              <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
                                              {sub.name}
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="text-center py-2">
                                          <p className="text-[10px] text-gray-400 italic">{t('academic.noSubjects')}</p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-4 bg-white rounded-lg border border-dashed border-gray-200">
                                <p className="text-xs text-gray-400 italic">{t('academic.noSemesters')}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-100">
                  <Calendar size={40} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-gray-400 font-medium">{t('academic.noYears')}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-4 mt-2 border-t border-gray-50">
              <button
                type="button"
                className="px-10 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-gray-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => setShowDetailsModal(false)}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default DepartmentsPage;
