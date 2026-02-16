import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { academicAPI } from '../../services/api';

const YearsPage = () => {
  const { t } = useTranslation();
  const [years, setYears] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');

  const fetchYears = async (page = 1, department_id) => {
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
      setError('فشل تحميل السنوات');
      setYears([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // load departments for filter
    academicAPI
      .getDepartments({ page: 1 })
      .then((res) => setDepartments(res.data || []))
      .catch(() => setDepartments([]));
    fetchYears(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChangeDepartment = (e) => {
    const value = e.target.value;
    setDepartmentFilter(value);
    fetchYears(1, value || undefined);
  };

  return (
    <div className="students-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.years') || 'السنوات'}</h1>
          <p className="page-subtitle">{t('academic.yearsSubtitle') || 'إدارة السنوات الدراسية لكل قسم'}</p>
        </div>
      </div>

      <Card>
        <div className="table-controls">
          <div style={{ minWidth: 220 }}>
            <label className="input-label">القسم</label>
            <select
              className="input-field"
              value={departmentFilter}
              onChange={onChangeDepartment}
            >
              <option value="">كل الأقسام</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500">جاري تحميل السنوات...</div>
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
                    <th>الترتيب</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((y) => (
                    <tr key={y.id}>
                      <td className="font-medium">{y.name}</td>
                      <td>{y.department?.name || '—'}</td>
                      <td>{y.order ?? 0}</td>
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
                  onClick={() => fetchYears(pagination.current_page - 1, departmentFilter || undefined)}
                >
                  {t('common.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page >= pagination.last_page}
                  onClick={() => fetchYears(pagination.current_page + 1, departmentFilter || undefined)}
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

export default YearsPage;

