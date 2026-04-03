import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { dashboardAPI } from '../../services/api';
import { formatDateTime } from '../../utils/date';
import './SupportPage.css';

const SupportPage = () => {
    const { t, i18n } = useTranslation();
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState(null);
    const [messages, setMessages] = useState([]);
    const [lastPage, setLastPage] = useState(1);
    const [updatingId, setUpdatingId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: 20 };
            if (statusFilter) params.status = statusFilter;
            const res = await dashboardAPI.supportMessages(params);
            setSummary(res.summary || null);
            const pag = res.messages || {};
            setMessages(Array.isArray(pag.data) ? pag.data : []);
            setLastPage(pag.last_page || 1);
        } catch (e) {
            console.error(e);
            setMessages([]);
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => {
        load();
    }, [load]);

    const handleStatusChange = async (id, status) => {
        setUpdatingId(id);
        try {
            await dashboardAPI.updateSupportStatus(id, status);
            await load();
        } catch (e) {
            console.error(e);
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <div className="support-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('support.title')}</h1>
                    <p className="page-subtitle">{t('support.subtitle')}</p>
                </div>
                <Button type="button" variant="outline" onClick={() => load()} disabled={loading}>
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    {t('common.refresh') || 'تحديث'}
                </Button>
            </div>

            {summary && (
                <div className="support-summary">
                    <div className="support-summary-item">
                        <span className="label">{t('support.total')}</span>
                        <strong>{summary.total ?? 0}</strong>
                    </div>
                    <div className="support-summary-item new">
                        <span className="label">{t('support.statusNew')}</span>
                        <strong>{summary.new ?? 0}</strong>
                    </div>
                    <div className="support-summary-item">
                        <span className="label">{t('support.statusRead')}</span>
                        <strong>{summary.read ?? 0}</strong>
                    </div>
                    <div className="support-summary-item">
                        <span className="label">{t('support.statusReplied')}</span>
                        <strong>{summary.replied ?? 0}</strong>
                    </div>
                </div>
            )}

            <Card className="support-filters">
                <label className="support-filter-label">{t('support.filterStatus')}</label>
                <select
                    className="input-field support-filter-select"
                    value={statusFilter}
                    onChange={(e) => {
                        setPage(1);
                        setStatusFilter(e.target.value);
                    }}
                >
                    <option value="">{t('support.allStatuses')}</option>
                    <option value="new">{t('support.statusNew')}</option>
                    <option value="read">{t('support.statusRead')}</option>
                    <option value="replied">{t('support.statusReplied')}</option>
                </select>
            </Card>

            <Card title={t('support.inboxTitle')}>
                {loading && (
                    <div className="p-6 flex items-center gap-2 text-gray-500">
                        <Loader2 className="animate-spin" size={20} />
                        {t('common.loading')}
                    </div>
                )}
                {!loading && !messages.length && (
                    <p className="p-6 text-sm text-gray-500">{t('support.empty')}</p>
                )}
                {!loading && messages.length > 0 && (
                    <div className="support-table-wrap">
                        <table className="support-table">
                            <thead>
                                <tr>
                                    <th>{t('support.colDate')}</th>
                                    <th>{t('support.colUser')}</th>
                                    <th>{t('support.colSubject')}</th>
                                    <th>{t('support.colMessage')}</th>
                                    <th>{t('support.colStatus')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {messages.map((row) => (
                                    <tr key={row.id}>
                                        <td className="support-cell-muted">
                                            {row.created_at
                                                ? formatDateTime(row.created_at, i18n.language)
                                                : '—'}
                                        </td>
                                        <td>
                                            <div className="support-user-name">{row.name || row.user?.full_name || '—'}</div>
                                            <div className="support-user-email">{row.email || row.user?.email || ''}</div>
                                        </td>
                                        <td>{row.subject || '—'}</td>
                                        <td className="support-message-cell">
                                            <pre className="support-message-pre">{row.message}</pre>
                                        </td>
                                        <td>
                                            <select
                                                className="input-field support-status-select"
                                                value={row.status}
                                                disabled={updatingId === row.id}
                                                onChange={(e) => handleStatusChange(row.id, e.target.value)}
                                            >
                                                <option value="new">{t('support.statusNew')}</option>
                                                <option value="read">{t('support.statusRead')}</option>
                                                <option value="replied">{t('support.statusReplied')}</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {!loading && lastPage > 1 && (
                    <div className="support-pagination">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            {t('support.prev')}
                        </Button>
                        <span className="support-page-info">
                            {page} / {lastPage}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={page >= lastPage}
                            onClick={() => setPage((p) => p + 1)}
                        >
                            {t('support.next')}
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default SupportPage;
