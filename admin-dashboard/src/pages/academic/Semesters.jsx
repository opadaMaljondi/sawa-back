import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { academicAPI } from '../../services/api';

const SemestersPage = () => {
  const { t } = useTranslation();
  const [semesters, setSemesters] = useState([]);
  const [years, setYears] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  const fetchSemesters = async (page = 1, year_id) => {
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
      setError('فشل تحميل الفصول');
      setSemesters([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    academicAPI
      .getYears({ page: 1 })
      .then((res) => setYears(res.data || []))
      .catch(() => setYears([]));
    fetchSemesters(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChangeYear = (e) => {
    const value = e.target.value;
    setYearFilter(value);
    fetchSemesters(1, value || undefined);
  };

  return (
    <div className="students-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('nav.semesters') || 'الفصول'}</h1>
          <p className="page-subtitle">{t('academic.semestersSubtitle') || 'إدارة الفصول الدراسية لكل سنة'}</p>
        </div>
      </div>

      <Card>
        <div className="table-controls">
          <div style={{ minWidth: 220 }}>
            <label className="input-label">السنة</label>
            <select
              className="input-field"
              value={yearFilter}
              onChange={onChangeYear}
            >
              <option value="">كل السنوات</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500">جاري تحميل الفصول...</div>
        ) : error ? (
          <div className="p-6 text-center text-sm text-red-600">{error}</div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>السنة</th>
                    <th>الترتيب</th>
                  </tr>
                </thead>
                <tbody>
                  {semesters.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.name}</td>
                      <td>{s.year?.name || '—'}</td>
                      <td>{s.order ?? 0}</td>
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
                  onClick={() => fetchSemesters(pagination.current_page - 1, yearFilter || undefined)}
                >
                  {t('common.previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page >= pagination.last_page}
                  onClick={() => fetchSemesters(pagination.current_page + 1, yearFilter || undefined)}
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

export default SemestersPage;

