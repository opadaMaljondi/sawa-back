import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { academicAPI } from '../../services/api';

const DepartmentsPage = () => {
  const { t } = useTranslation();
  const [departments, setDepartments] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchDepartments = async (page = 1) => {
    try {
      setLoading(true);
      setError('');
      const res = await academicAPI.getDepartments({ page });
      setDepartments(res.data || []);
      setPagination({ current_page: res.current_page, last_page: res.last_page });
    } catch (e) {
      console.error(e);
      setError('فشل تحميل الأقسام');
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = search
    ? departments.filter((d) =>
        (d.name || '').toLowerCase().includes(search.toLowerCase()),
      )
    : departments;

  return (
    <div className="students-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.departments') || 'الأقسام'}</h1>
          <p className="page-subtitle">{t('academic.departmentsSubtitle') || 'إدارة الأقسام الأكاديمية'}</p>
        </div>
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
          <div className="p-6 text-center text-sm text-gray-500">جاري تحميل الأقسام...</div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-red-600">{error}</div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>الوصف</th>
                    <th>الترتيب</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((dep) => (
                    <tr key={dep.id}>
                      <td className="font-medium">{dep.name}</td>
                      <td>{dep.description || '—'}</td>
                      <td>{dep.order ?? 0}</td>
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
    </div>
  );
};

export default DepartmentsPage;

