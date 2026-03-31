import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import Card from '../../components/common/Card';
import Input from '../../components/common/Input';
import { referralsAPI } from '../../services/api';
import './ReferralsPage.css';

const ReferralsPage = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const res = await referralsAPI.stats();
      setStats(res);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchRows = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError('');
        const params = { page, per_page: 20 };
        if (search.trim()) params.search = search.trim();
        if (statusFilter) params.bonus_status = statusFilter;
        const res = await referralsAPI.list(params);
        setRows(res.data || []);
        setPagination({
          current_page: res.current_page,
          last_page: res.last_page,
          total: res.total,
        });
      } catch (e) {
        console.error(e);
        setError(t('referrals.loadError'));
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter, t]
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchRows(1);
  }, [fetchRows]);

  const statusLabel = (s) => t(`referrals.status.${s}`, { defaultValue: s });

  return (
    <div className="referrals-page">
      <div className="page-header">
        <div>
          <h1 className="page-title referrals-title-row">
            <Gift size={28} className="inline-icon" />
            {t('referrals.title')}
          </h1>
          <p className="page-subtitle">{t('referrals.subtitle')}</p>
        </div>
      </div>

      {stats && (
        <div className="referrals-stats-grid">
          <Card className="referrals-stat-card">
            <div className="referrals-stat-value">{stats.total_referrals ?? 0}</div>
            <div className="referrals-stat-label">{t('referrals.total')}</div>
          </Card>
          {stats.by_status && typeof stats.by_status === 'object' && !Array.isArray(stats.by_status) &&
            Object.entries(stats.by_status).map(([k, v]) => (
              <Card key={k} className="referrals-stat-card">
                <div className="referrals-stat-value">{v}</div>
                <div className="referrals-stat-label">{statusLabel(k)}</div>
              </Card>
            ))}
        </div>
      )}

      <Card className="referrals-table-card">
        <div className="referrals-toolbar">
          <div className="referrals-search">
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('referrals.searchPlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && setSearch(searchInput)}
            />
            <button type="button" className="referrals-search-btn" onClick={() => setSearch(searchInput)}>
              <Search size={18} />
            </button>
          </div>
          <select
            className="referrals-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{t('referrals.allStatuses')}</option>
            <option value="pending">{statusLabel('pending')}</option>
            <option value="earned">{statusLabel('earned')}</option>
            <option value="paid">{statusLabel('paid')}</option>
          </select>
        </div>

        {error && <div className="referrals-error">{error}</div>}

        {loading ? (
          <div className="p-6 text-center">{t('common.loading')}</div>
        ) : (
          <>
            <div className="referrals-table-wrap">
              <table className="referrals-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{t('referrals.inviter')}</th>
                    <th>{t('referrals.invited')}</th>
                    <th>{t('referrals.code')}</th>
                    <th>{t('referrals.bonusStatus')}</th>
                    <th>{t('referrals.bonusAmount')}</th>
                    <th>{t('referrals.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="referrals-empty">{t('referrals.empty')}</td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td>
                          <div>{r.referrer?.full_name ?? '—'}</div>
                          <small className="muted">{r.referrer?.email}</small>
                        </td>
                        <td>
                          <div>{r.referred?.full_name ?? '—'}</div>
                          <small className="muted">{r.referred?.email}</small>
                        </td>
                        <td><code>{r.referral_code}</code></td>
                        <td>{statusLabel(r.bonus_status)}</td>
                        <td>{r.bonus_amount != null ? Number(r.bonus_amount).toLocaleString() : '—'}</td>
                        <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {pagination.last_page > 1 && (
              <div className="referrals-pagination">
                <button
                  type="button"
                  disabled={pagination.current_page <= 1}
                  onClick={() => fetchRows(pagination.current_page - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <span>
                  {pagination.current_page} / {pagination.last_page} ({pagination.total})
                </span>
                <button
                  type="button"
                  disabled={pagination.current_page >= pagination.last_page}
                  onClick={() => fetchRows(pagination.current_page + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
};

export default ReferralsPage;
