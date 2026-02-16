import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
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
      setError('فشل تحميل المواد');
      setSubjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    academicAPI
      .getDepartments({ page: 1 })
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
      const resYears = await academicAPI.getYears({ department_id, page: 1 }).catch(() => null);
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
      const resSem = await academicAPI.getSemesters({ year_id, page: 1 }).catch(() => null);
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

  return (
    <div className="students-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.subjects') || 'المواد'}</h1>
          <p className="page-subtitle">{t('academic.subjectsSubtitle') || 'إدارة المواد ضمن الهيكل الدراسي'}</p>
        </div>
      </div>

      <Card>
        <div className="table-controls" style={{ gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 180 }}>
            <label className="input-label">القسم</label>
            <select
              className="input-field"
              value={filters.department_id}
              onChange={handleDepartmentChange}
            >
              <option value="">كل الأقسام</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 180 }}>
            <label className="input-label">السنة</label>
            <select
              className="input-field"
              value={filters.year_id}
              onChange={handleYearChange}
              disabled={!years.length}
            >
              <option value="">كل السنوات</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 180 }}>
            <label className="input-label">الفصل</label>
            <select
              className="input-field"
              value={filters.semester_id}
              onChange={handleSemesterChange}
              disabled={!semesters.length}
            >
              <option value="">كل الفصول</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500">جاري تحميل المواد...</div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-red-600">{error}</div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>القسم</th>
                    <th>السنة</th>
                    <th>الفصل</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.name}</td>
                      <td>{s.department?.name || '—'}</td>
                      <td>{s.year?.name || '—'}</td>
                      <td>{s.semester?.name || '—'}</td>
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
    </div>
  );
};

export default SubjectsPage;

