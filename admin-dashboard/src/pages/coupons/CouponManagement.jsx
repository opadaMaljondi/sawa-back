import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit2, Trash2, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import { couponsAPI, dashboardAPI } from '../../services/api';
import './CouponManagement.css';

function toDatetimeLocal(input) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyForm() {
  const start = new Date();
  const end = new Date();
  end.setMonth(end.getMonth() + 3);
  return {
    code: '',
    description: '',
    type: 'percentage',
    value: '',
    min_purchase: '',
    max_discount: '',
    usage_limit: '',
    usage_per_user: '1',
    active: true,
    valid_from: toDatetimeLocal(start),
    valid_until: toDatetimeLocal(end),
  };
}

function couponToForm(c) {
  return {
    code: c.code || '',
    description: c.description || '',
    type: c.type || 'percentage',
    value: c.value != null ? String(c.value) : '',
    min_purchase: c.min_purchase != null ? String(c.min_purchase) : '',
    max_discount: c.max_discount != null ? String(c.max_discount) : '',
    usage_limit: c.usage_limit != null ? String(c.usage_limit) : '',
    usage_per_user: String(c.usage_per_user ?? 1),
    active: Boolean(c.active),
    valid_from: toDatetimeLocal(c.valid_from),
    valid_until: toDatetimeLocal(c.valid_until),
  };
}

function buildPayload(form) {
  return {
    code: form.code.trim(),
    description: form.description?.trim() || null,
    type: form.type,
    value: Number(form.value),
    min_purchase: form.min_purchase === '' ? null : Number(form.min_purchase),
    max_discount: form.max_discount === '' ? null : Number(form.max_discount),
    usage_limit: form.usage_limit === '' ? null : parseInt(form.usage_limit, 10),
    usage_per_user: parseInt(form.usage_per_user, 10) || 1,
    active: Boolean(form.active),
    valid_from: new Date(form.valid_from).toISOString(),
    valid_until: new Date(form.valid_until).toISOString(),
  };
}

const CouponManagement = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await dashboardAPI.couponStats();
      setStats(res?.summary || null);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchCoupons = useCallback(
    async (page = 1) => {
      try {
        setLoading(true);
        setError('');
        const params = { page, per_page: 15 };
        if (search.trim()) params.search = search.trim();
        if (activeFilter === 'active') params.active = true;
        if (activeFilter === 'inactive') params.active = false;
        const res = await couponsAPI.list(params);
        setRows(res.data || []);
        setPagination({
          current_page: res.current_page || 1,
          last_page: res.last_page || 1,
          total: res.total ?? 0,
        });
      } catch (e) {
        console.error(e);
        setError(t('coupon.loadError'));
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [search, activeFilter, t],
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    fetchCoupons(1);
  }, [fetchCoupons, search, activeFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm(couponToForm(row));
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = buildPayload(form);
      if (editing) {
        await couponsAPI.update(editing.id, payload);
      } else {
        await couponsAPI.create(payload);
      }
      setModalOpen(false);
      await fetchCoupons(pagination.current_page);
      await fetchStats();
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        (err.response?.data?.errors && JSON.stringify(err.response.data.errors)) ||
        t('coupon.saveError');
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(t('coupon.confirmDelete'))) return;
    try {
      await couponsAPI.delete(row.id);
      await fetchCoupons(pagination.current_page);
      await fetchStats();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || t('coupon.deleteError'));
    }
  };

  const formatValue = (row) =>
    row.type === 'percentage' ? `${row.value}%` : `${Number(row.value).toLocaleString()} SYP`;

  const formatLimit = (row) => {
    if (row.usage_limit == null) return t('coupon.unlimited');
    return `${row.used_count ?? 0} / ${row.usage_limit}`;
  };

  const goPage = (p) => {
    if (p < 1 || p > pagination.last_page) return;
    fetchCoupons(p);
  };

  return (
    <div className="students-page coupon-page">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Tag size={28} className="text-violet-600" />
            {t('coupon.title')}
          </h1>
          <p className="page-subtitle">{t('coupon.subtitle')}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus size={18} />
          {t('coupon.addCoupon')}
        </Button>
      </div>

      {stats && (
        <div className="coupon-stats-grid">
          <Card className="coupon-stat-card">
            <div className="coupon-stat-label">{t('coupon.statsTotal')}</div>
            <div className="coupon-stat-value">{stats.total_coupons ?? '—'}</div>
          </Card>
          <Card className="coupon-stat-card">
            <div className="coupon-stat-label">{t('coupon.statsActive')}</div>
            <div className="coupon-stat-value">{stats.active_coupons ?? '—'}</div>
          </Card>
          <Card className="coupon-stat-card">
            <div className="coupon-stat-label">{t('coupon.statsExpired')}</div>
            <div className="coupon-stat-value">{stats.expired_coupons ?? '—'}</div>
          </Card>
          <Card className="coupon-stat-card">
            <div className="coupon-stat-label">{t('coupon.statsUses')}</div>
            <div className="coupon-stat-value">{stats.total_uses ?? '—'}</div>
          </Card>
          <Card className="coupon-stat-card coupon-stat-card--wide">
            <div className="coupon-stat-label">{t('coupon.statsSaved')}</div>
            <div className="coupon-stat-value">
              {stats.total_saved != null ? Number(stats.total_saved).toLocaleString() : '—'}
            </div>
          </Card>
        </div>
      )}

      <Card>
        <div className="coupon-toolbar">
          <div className="coupon-toolbar-search">
            <Search size={18} className="coupon-toolbar-icon" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('coupon.search')}
              className="flex-1"
            />
          </div>
          <div className="coupon-toolbar-filter">
            <label className="input-label mb-0">{t('coupon.filterActive')}</label>
            <select
              className="input-field coupon-select"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
            >
              <option value="all">{t('coupon.all')}</option>
              <option value="active">{t('coupon.activeOnly')}</option>
              <option value="inactive">{t('coupon.inactiveOnly')}</option>
            </select>
          </div>
        </div>

        {error && <div className="coupon-banner-error">{error}</div>}

        {loading ? (
          <div className="coupon-loading">{t('common.loading')}</div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table text-sm">
                <thead>
                  <tr>
                    <th>{t('coupon.code')}</th>
                    <th>{t('coupon.type')}</th>
                    <th>{t('coupon.value')}</th>
                    <th>{t('coupon.usedCount')}</th>
                    <th>{t('coupon.validFrom')}</th>
                    <th>{t('coupon.validUntil')}</th>
                    <th>{t('coupon.active')}</th>
                    <th className="text-end">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-gray-500 py-8">
                        —
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id}>
                        <td className="font-mono font-semibold">{row.code}</td>
                        <td>
                          {row.type === 'percentage'
                            ? t('coupon.typePercentage')
                            : t('coupon.typeFixed')}
                        </td>
                        <td>{formatValue(row)}</td>
                        <td>{formatLimit(row)}</td>
                        <td className="whitespace-nowrap text-gray-600">
                          {row.valid_from ? new Date(row.valid_from).toLocaleString() : '—'}
                        </td>
                        <td className="whitespace-nowrap text-gray-600">
                          {row.valid_until ? new Date(row.valid_until).toLocaleString() : '—'}
                        </td>
                        <td>{row.active ? t('coupon.yes') : t('coupon.no')}</td>
                        <td className="text-end">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              className="coupon-icon-btn"
                              onClick={() => openEdit(row)}
                              title={t('coupon.editCoupon')}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              className="coupon-icon-btn coupon-icon-btn--danger"
                              onClick={() => handleDelete(row)}
                              title={t('common.delete')}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {pagination.last_page > 1 && (
              <div className="coupon-pagination">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page <= 1}
                  onClick={() => goPage(pagination.current_page - 1)}
                >
                  <ChevronRight size={18} />
                </Button>
                <span className="coupon-pagination-info">
                  {pagination.current_page} / {pagination.last_page} ({pagination.total})
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.current_page >= pagination.last_page}
                  onClick={() => goPage(pagination.current_page + 1)}
                >
                  <ChevronLeft size={18} />
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        title={editing ? t('coupon.editCoupon') : t('coupon.addCoupon')}
        size="lg"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" form="coupon-form" loading={submitting}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <form id="coupon-form" className="coupon-form" onSubmit={handleSubmit}>
          <div className="coupon-form-grid">
            <div>
              <label className="input-label">{t('coupon.code')}</label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                required
                maxLength={64}
              />
            </div>
            <div>
              <label className="input-label">{t('coupon.type')}</label>
              <select
                className="input-field"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="percentage">{t('coupon.typePercentage')}</option>
                <option value="fixed">{t('coupon.typeFixed')}</option>
              </select>
            </div>
            <div>
              <label className="input-label">{t('coupon.value')}</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                required
              />
            </div>
            <div className="coupon-form-full">
              <label className="input-label">{t('coupon.description')}</label>
              <textarea
                className="input-field coupon-textarea"
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="input-label">{t('coupon.minPurchase')}</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.min_purchase}
                onChange={(e) => setForm((f) => ({ ...f, min_purchase: e.target.value }))}
              />
            </div>
            <div>
              <label className="input-label">{t('coupon.maxDiscount')}</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.max_discount}
                onChange={(e) => setForm((f) => ({ ...f, max_discount: e.target.value }))}
              />
            </div>
            <div>
              <label className="input-label">{t('coupon.usageLimit')}</label>
              <Input
                type="number"
                min="1"
                value={form.usage_limit}
                onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))}
                placeholder={t('coupon.unlimited')}
              />
            </div>
            <div>
              <label className="input-label">{t('coupon.usagePerUser')}</label>
              <Input
                type="number"
                min="1"
                value={form.usage_per_user}
                onChange={(e) => setForm((f) => ({ ...f, usage_per_user: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="input-label">{t('coupon.validFrom')}</label>
              <Input
                type="datetime-local"
                value={form.valid_from}
                onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="input-label">{t('coupon.validUntil')}</label>
              <Input
                type="datetime-local"
                value={form.valid_until}
                onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                required
              />
            </div>
            <div className="coupon-form-check">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                />
                <span>{t('coupon.active')}</span>
              </label>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CouponManagement;
