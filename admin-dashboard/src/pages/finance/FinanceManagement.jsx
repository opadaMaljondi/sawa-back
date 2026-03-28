import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Wallet,
  ArrowUpRight,
  RefreshCw,
  Loader2,
  Search,
  Info,
  ExternalLink,
} from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import { walletsAPI, teachersAPI, financeAPI } from '../../services/api';
import { formatDateTime } from '../../utils/date';
import './FinanceManagement.css';

const txTypeLabel = (type, t) => {
  if (type === 'deposit') return t('finance.deposit');
  if (type === 'withdrawal') return t('finance.withdrawal');
  if (type === 'refund') return t('finance.refund');
  return type;
};

const txBadgeClass = (type) => {
  if (type === 'deposit') return 'finance-badge finance-badge--deposit';
  if (type === 'withdrawal') return 'finance-badge finance-badge--withdrawal';
  if (type === 'refund') return 'finance-badge finance-badge--refund';
  return 'finance-badge finance-badge--student';
};

const userInitial = (name) => (name && name.trim() ? name.trim().charAt(0).toUpperCase() : '?');

const UserCell = ({ user }) => (
  <div className="finance-user-cell">
    <div className="finance-user-avatar" aria-hidden>
      {userInitial(user?.full_name)}
    </div>
    <div className="finance-user-meta">
      <div className="finance-user-name">{user?.full_name ?? '—'}</div>
      <div className="finance-user-sub">{user?.email ?? '—'}</div>
    </div>
  </div>
);

const FinancePagination = ({ meta, onPrev, onNext, loading }) => {
  if (!meta || meta.last_page <= 1) return null;
  return (
    <div className="finance-pagination">
      <span className="finance-pagination-info">
        صفحة {meta.current_page} من {meta.last_page}
        {meta.total != null ? ` — ${meta.total} سجل` : ''}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={loading || meta.current_page <= 1} onClick={onPrev}>
          السابق
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={loading || meta.current_page >= meta.last_page}
          onClick={onNext}
        >
          التالي
        </Button>
      </div>
    </div>
  );
};

const FinanceManagement = () => {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState('tx');

  const [txLoading, setTxLoading] = useState(false);
  const [txData, setTxData] = useState([]);
  const [txPage, setTxPage] = useState(1);
  const [txMeta, setTxMeta] = useState({ last_page: 1, current_page: 1 });
  const [txType, setTxType] = useState('');
  const [txUserType, setTxUserType] = useState('');
  const [txSearch, setTxSearch] = useState('');
  const [txFrom, setTxFrom] = useState('');
  const [txTo, setTxTo] = useState('');

  const [balLoading, setBalLoading] = useState(false);
  const [balData, setBalData] = useState([]);
  const [balPage, setBalPage] = useState(1);
  const [balMeta, setBalMeta] = useState({ last_page: 1, current_page: 1 });
  const [balUserType, setBalUserType] = useState('all');
  const [balSearch, setBalSearch] = useState('');

  const [teachLoading, setTeachLoading] = useState(false);
  const [teachData, setTeachData] = useState([]);
  const [teachPage, setTeachPage] = useState(1);
  const [teachMeta, setTeachMeta] = useState({ last_page: 1, current_page: 1 });
  const [teachSearch, setTeachSearch] = useState('');

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState('deposit');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [adjustError, setAdjustError] = useState('');

  const [platformTotals, setPlatformTotals] = useState(null);
  const [platformLoading, setPlatformLoading] = useState(true);

  const loadPlatformTotals = useCallback(async () => {
    setPlatformLoading(true);
    try {
      const res = await financeAPI.getPlatformTotals();
      setPlatformTotals(res);
    } catch (e) {
      console.error(e);
      setPlatformTotals(null);
    } finally {
      setPlatformLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlatformTotals();
  }, [loadPlatformTotals]);

  const fmtMoney = (n) => {
    if (n == null || Number.isNaN(Number(n))) return '—';
    return Number(n).toLocaleString(i18n.language?.startsWith('ar') ? 'ar-SY' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const params = { page: txPage, limit: 25 };
      if (txType) params.type = txType;
      if (txUserType) params.user_type = txUserType;
      if (txSearch.trim()) params.search = txSearch.trim();
      if (txFrom) params.from = txFrom;
      if (txTo) params.to = txTo;
      const res = await walletsAPI.transactions(params);
      setTxData(res.data || []);
      setTxMeta({
        current_page: res.current_page ?? 1,
        last_page: res.last_page ?? 1,
        total: res.total ?? 0,
      });
    } catch (e) {
      console.error(e);
      setTxData([]);
    } finally {
      setTxLoading(false);
    }
  }, [txPage, txType, txUserType, txSearch, txFrom, txTo]);

  const loadBalances = useCallback(async () => {
    setBalLoading(true);
    try {
      const params = { page: balPage, limit: 25 };
      if (balUserType === 'all') params.user_type = 'all';
      else if (balUserType) params.user_type = balUserType;
      if (balSearch.trim()) params.search = balSearch.trim();
      const res = await walletsAPI.list(params);
      setBalData(res.data || []);
      setBalMeta({
        current_page: res.current_page ?? 1,
        last_page: res.last_page ?? 1,
        total: res.total ?? 0,
      });
    } catch (e) {
      console.error(e);
      setBalData([]);
    } finally {
      setBalLoading(false);
    }
  }, [balPage, balUserType, balSearch]);

  const loadTeachersFinance = useCallback(async () => {
    setTeachLoading(true);
    try {
      const params = { page: teachPage, per_page: 20 };
      if (teachSearch.trim()) params.search = teachSearch.trim();
      const res = await teachersAPI.getFinanceSummary(params);
      setTeachData(res.data || []);
      setTeachMeta({
        current_page: res.current_page ?? 1,
        last_page: res.last_page ?? 1,
        total: res.total ?? 0,
      });
    } catch (e) {
      console.error(e);
      setTeachData([]);
    } finally {
      setTeachLoading(false);
    }
  }, [teachPage, teachSearch]);

  useEffect(() => {
    if (tab !== 'tx') return;
    const d = setTimeout(loadTransactions, txSearch ? 400 : 0);
    return () => clearTimeout(d);
  }, [tab, loadTransactions, txSearch]);

  useEffect(() => {
    if (tab !== 'balances') return;
    const d = setTimeout(loadBalances, balSearch ? 400 : 0);
    return () => clearTimeout(d);
  }, [tab, loadBalances, balSearch]);

  useEffect(() => {
    if (tab !== 'teachers') return;
    const d = setTimeout(loadTeachersFinance, teachSearch ? 400 : 0);
    return () => clearTimeout(d);
  }, [tab, loadTeachersFinance, teachSearch]);

  const openAdjust = (user) => {
    setAdjustTarget(user);
    setAdjustAmount('');
    setAdjustType('deposit');
    setAdjustNote('');
    setAdjustError('');
    setAdjustOpen(true);
  };

  const submitAdjust = async (e) => {
    e.preventDefault();
    setAdjustError('');
    const amt = Number(adjustAmount);
    if (!adjustTarget || !amt || amt <= 0) {
      setAdjustError('مبلغ غير صالح');
      return;
    }
    setAdjustLoading(true);
    try {
      await walletsAPI.adjust(adjustTarget.id, {
        type: adjustType,
        amount: amt,
        note: adjustNote.trim() || undefined,
      });
      setAdjustOpen(false);
      loadBalances();
      loadPlatformTotals();
      if (tab === 'tx') loadTransactions();
    } catch (err) {
      setAdjustError(err.response?.data?.message || 'فشلت العملية');
    } finally {
      setAdjustLoading(false);
    }
  };

  const tabs = [
    { id: 'tx', label: t('finance.tabTransactions'), icon: RefreshCw },
    { id: 'balances', label: t('finance.tabBalances'), icon: Wallet },
    { id: 'teachers', label: t('finance.tabTeachers'), icon: ArrowUpRight },
  ];

  const currentMeta =
    tab === 'tx' ? txMeta : tab === 'balances' ? balMeta : teachMeta;
  const currentLoading = tab === 'tx' ? txLoading : tab === 'balances' ? balLoading : teachLoading;

  return (
    <div className="students-page finance-page">
      <header className="finance-hero">
        <div className="finance-hero-icon" aria-hidden>
          <Wallet size={28} strokeWidth={1.75} />
        </div>
        <div className="finance-hero-text">
          <h1 className="page-title">{t('finance.title')}</h1>
          <p className="page-subtitle">{t('finance.subtitle')}</p>
        </div>
      </header>

      <section className="finance-platform" aria-labelledby="finance-platform-heading">
        <div className="finance-platform-head">
          <div>
            <h2 id="finance-platform-heading" className="finance-platform-title">
              {t('finance.platformOverview')}
            </h2>
            <p className="finance-platform-desc">{t('finance.platformOverviewHint')}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadPlatformTotals()}
            loading={platformLoading}
          >
            {t('finance.refreshTotals')}
          </Button>
        </div>

        {platformLoading && !platformTotals ? (
          <div className="finance-loading finance-loading--compact">
            <Loader2 size={22} />
            {t('common.loading')}
          </div>
        ) : platformTotals ? (
          <>
            <div className="finance-platform-highlight">
              <div className="finance-platform-highlight-inner">
                <span className="finance-platform-highlight-label">{t('finance.totalPlatformCommission')}</span>
                <span className="finance-platform-highlight-value">{fmtMoney(platformTotals.platform_commission_total)}</span>
                <span className="finance-platform-currency">SYP</span>
              </div>
              <div className="finance-platform-highlight-sub">
                <span>{t('finance.totalCoursePayments')}: </span>
                <strong>{fmtMoney(platformTotals.course_payments_gross_total)}</strong>
                <span className="mx-2">·</span>
                <span>{t('finance.totalTeacherShare')}: </span>
                <strong>{fmtMoney(platformTotals.teacher_share_accrued_total)}</strong>
              </div>
            </div>

            <h3 className="finance-platform-sec-title">{t('finance.secStudents')}</h3>
            <div className="finance-platform-grid">
              <div className="finance-platform-card">
                <span className="finance-platform-card-label">{t('finance.totalStudentDeposits')}</span>
                <span className="finance-platform-card-value">{fmtMoney(platformTotals.student_wallet_deposits_total)}</span>
              </div>
              <div className="finance-platform-card">
                <span className="finance-platform-card-label">{t('finance.totalStudentSpending')}</span>
                <span className="finance-platform-card-value">{fmtMoney(platformTotals.student_wallet_spending_total)}</span>
              </div>
              <div className="finance-platform-card">
                <span className="finance-platform-card-label">{t('finance.totalStudentRefunds')}</span>
                <span className="finance-platform-card-value">{fmtMoney(platformTotals.student_wallet_refunds_total)}</span>
              </div>
              <div className="finance-platform-card finance-platform-card--muted">
                <span className="finance-platform-card-label">{t('finance.totalStudentBalances')}</span>
                <span className="finance-platform-card-value">{fmtMoney(platformTotals.student_wallets_balance_total)}</span>
              </div>
            </div>

            <h3 className="finance-platform-sec-title">{t('finance.secInstructors')}</h3>
            <div className="finance-platform-grid">
              <div className="finance-platform-card">
                <span className="finance-platform-card-label">{t('finance.totalInstructorDeposits')}</span>
                <span className="finance-platform-card-value">{fmtMoney(platformTotals.instructor_wallet_deposits_total)}</span>
              </div>
              <div className="finance-platform-card finance-platform-card--warn">
                <span className="finance-platform-card-label">{t('finance.totalInstructorWithdrawals')}</span>
                <span className="finance-platform-card-value">{fmtMoney(platformTotals.instructor_withdrawals_total)}</span>
              </div>
              <div className="finance-platform-card finance-platform-card--muted">
                <span className="finance-platform-card-label">{t('finance.totalInstructorBalances')}</span>
                <span className="finance-platform-card-value">{fmtMoney(platformTotals.instructor_wallets_balance_total)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="finance-empty">{t('finance.platformLoadError')}</div>
        )}
      </section>

      <div className="finance-tabs" role="tablist" aria-label={t('finance.title')}>
        {tabs.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            className={`finance-tab ${tab === x.id ? 'finance-tab--active' : ''}`}
            onClick={() => {
              setTab(x.id);
              if (x.id === 'tx') setTxPage(1);
              if (x.id === 'balances') setBalPage(1);
              if (x.id === 'teachers') setTeachPage(1);
            }}
          >
            <x.icon size={17} strokeWidth={2} />
            {x.label}
          </button>
        ))}
      </div>

      <div className="finance-stats">
        <div className="finance-stat finance-stat--accent">
          <div className="finance-stat-label">{t('finance.statsTotal')}</div>
          <div className="finance-stat-value">{currentMeta.total ?? '—'}</div>
        </div>
        <div className="finance-stat">
          <div className="finance-stat-label">{t('finance.statsPage')}</div>
          <div className="finance-stat-value">
            {currentMeta.current_page} / {currentMeta.last_page}
          </div>
        </div>
        <div className="finance-stat">
          <div className="finance-stat-label">{t('finance.statsStatus')}</div>
          <div className="finance-stat-value" style={{ fontSize: '1rem', fontWeight: 600 }}>
            {currentLoading ? '…' : t('finance.statsReady')}
          </div>
        </div>
      </div>

      {tab === 'tx' && (
        <Card title={t('finance.tabTransactions')} subtitle={t('finance.txSubtitle')}>
          <div className="finance-card-inner">
            <div className="finance-filters finance-filters--wide">
              <div className="finance-filters-grid">
                <div>
                  <label className="input-label">{t('finance.filterType')}</label>
                  <select
                    className="input-field"
                    value={txType}
                    onChange={(e) => {
                      setTxType(e.target.value);
                      setTxPage(1);
                    }}
                  >
                    <option value="">{t('finance.allTypes')}</option>
                    <option value="deposit">{t('finance.deposit')}</option>
                    <option value="withdrawal">{t('finance.withdrawal')}</option>
                    <option value="refund">{t('finance.refund')}</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">{t('finance.filterUserType')}</label>
                  <select
                    className="input-field"
                    value={txUserType}
                    onChange={(e) => {
                      setTxUserType(e.target.value);
                      setTxPage(1);
                    }}
                  >
                    <option value="">{t('finance.allUsers')}</option>
                    <option value="student">{t('finance.student')}</option>
                    <option value="instructor">{t('finance.instructor')}</option>
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2', minWidth: 0 }}>
                  <label className="input-label flex items-center gap-1">
                    <Search size={14} /> {t('common.search')}
                  </label>
                  <input
                    className="input-field"
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder={t('finance.searchPlaceholder')}
                  />
                </div>
                <div>
                  <label className="input-label">{t('finance.dateFrom')}</label>
                  <input
                    type="date"
                    className="input-field"
                    value={txFrom}
                    onChange={(e) => {
                      setTxFrom(e.target.value);
                      setTxPage(1);
                    }}
                  />
                </div>
                <div>
                  <label className="input-label">{t('finance.dateTo')}</label>
                  <input
                    type="date"
                    className="input-field"
                    value={txTo}
                    onChange={(e) => {
                      setTxTo(e.target.value);
                      setTxPage(1);
                    }}
                  />
                </div>
              </div>
            </div>

            {txLoading ? (
              <div className="finance-loading">
                <Loader2 size={22} />
                {t('common.loading')}
              </div>
            ) : txData.length === 0 ? (
              <div className="finance-empty">{t('finance.emptyTx')}</div>
            ) : (
              <div className="finance-table-shell">
                <div className="table-container">
                  <table className="data-table text-sm">
                    <thead>
                      <tr>
                        <th>{t('finance.user')}</th>
                        <th>{t('finance.filterUserType')}</th>
                        <th>{t('finance.filterType')}</th>
                        <th>{t('finance.amount')}</th>
                        <th>{t('finance.balanceAfter')}</th>
                        <th>{t('finance.titleCol')}</th>
                        <th>{t('finance.dateCol')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {txData.map((row) => {
                        const u = row.wallet?.user;
                        const amt = Number(row.amount);
                        return (
                          <tr key={row.id}>
                            <td>{u ? <UserCell user={u} /> : '—'}</td>
                            <td>
                              <span
                                className={`finance-badge ${
                                  u?.type === 'instructor'
                                    ? 'finance-badge--instructor'
                                    : 'finance-badge--student'
                                }`}
                              >
                                {u?.type === 'instructor'
                                  ? t('finance.instructor')
                                  : t('finance.student')}
                              </span>
                            </td>
                            <td>
                              <span className={txBadgeClass(row.type)}>
                                {txTypeLabel(row.type, t)}
                              </span>
                            </td>
                            <td>
                              <span className={`finance-amt ${amt >= 0 ? 'finance-amt--in' : 'finance-amt--out'}`}>
                                {amt >= 0 ? '+' : ''}
                                {row.amount}
                              </span>
                            </td>
                            <td>
                              <span className="finance-balance-pill">{row.balance_after}</span>
                            </td>
                            <td className="max-w-[220px]">
                              <span className="truncate block" title={row.title}>
                                {row.title}
                              </span>
                            </td>
                            <td className="text-xs whitespace-nowrap text-gray-600">
                              {formatDateTime(row.created_at, i18n.language)}
                            </td>
                            <td>
                              {u && (
                                <Button variant="outline" size="sm" onClick={() => openAdjust(u)}>
                                  {t('finance.adjustWallet')}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <FinancePagination
                  meta={txMeta}
                  loading={txLoading}
                  onPrev={() => setTxPage((p) => p - 1)}
                  onNext={() => setTxPage((p) => p + 1)}
                />
              </div>
            )}
          </div>
        </Card>
      )}

      {tab === 'balances' && (
        <Card title={t('finance.tabBalances')} subtitle={t('finance.balSubtitle')}>
          <div className="finance-card-inner">
            <div className="finance-filters">
              <div className="finance-filters-grid">
                <div>
                  <label className="input-label">{t('finance.filterUserType')}</label>
                  <select
                    className="input-field"
                    value={balUserType}
                    onChange={(e) => {
                      setBalUserType(e.target.value);
                      setBalPage(1);
                    }}
                  >
                    <option value="all">{t('finance.allUsers')}</option>
                    <option value="student">{t('finance.student')}</option>
                    <option value="instructor">{t('finance.instructor')}</option>
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <label className="input-label flex items-center gap-1">
                    <Search size={14} /> {t('common.search')}
                  </label>
                  <input
                    className="input-field"
                    value={balSearch}
                    onChange={(e) => setBalSearch(e.target.value)}
                    placeholder={t('finance.searchPlaceholder')}
                  />
                </div>
              </div>
            </div>

            {balLoading ? (
              <div className="finance-loading">
                <Loader2 size={22} />
                {t('common.loading')}
              </div>
            ) : balData.length === 0 ? (
              <div className="finance-empty">{t('finance.emptyBalances')}</div>
            ) : (
              <div className="finance-table-shell">
                <div className="table-container">
                  <table className="data-table text-sm">
                    <thead>
                      <tr>
                        <th>{t('finance.user')}</th>
                        <th>{t('finance.filterUserType')}</th>
                        <th>{t('finance.walletBalance')}</th>
                        <th>{t('finance.actionsCol')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {balData.map((w) => {
                        const u = w.user;
                        return (
                          <tr key={w.id}>
                            <td>{u ? <UserCell user={u} /> : '—'}</td>
                            <td>
                              <span
                                className={`finance-badge ${
                                  u?.type === 'instructor'
                                    ? 'finance-badge--instructor'
                                    : 'finance-badge--student'
                                }`}
                              >
                                {u?.type === 'instructor'
                                  ? t('finance.instructor')
                                  : t('finance.student')}
                              </span>
                            </td>
                            <td>
                              <span className="finance-balance-pill">
                                {w.balance} {w.currency ?? 'SYP'}
                              </span>
                            </td>
                            <td>
                              <div className="finance-actions">
                                <Button variant="outline" size="sm" onClick={() => openAdjust(u)}>
                                  {t('finance.adjustWallet')}
                                </Button>
                                {u?.type === 'student' ? (
                                  <Link
                                    to={`/students/${u.id}`}
                                    className="finance-link"
                                  >
                                    <ExternalLink size={14} />
                                    {t('finance.openProfile')}
                                  </Link>
                                ) : (
                                  <Link to={`/teachers/${u.id}`} className="finance-link">
                                    <ExternalLink size={14} />
                                    {t('finance.openProfile')}
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <FinancePagination
                  meta={balMeta}
                  loading={balLoading}
                  onPrev={() => setBalPage((p) => p - 1)}
                  onNext={() => setBalPage((p) => p + 1)}
                />
              </div>
            )}
          </div>
        </Card>
      )}

      {tab === 'teachers' && (
        <Card title={t('finance.tabTeachers')} subtitle={t('finance.teachSubtitle')}>
          <div className="finance-card-inner">
            <div className="finance-hint">
              <Info size={18} className="flex-shrink-0" style={{ marginTop: 2 }} />
              <span>{t('finance.teachersHint')}</span>
            </div>
            <div className="finance-filters">
              <label className="input-label flex items-center gap-1">
                <Search size={14} /> {t('common.search')}
              </label>
              <input
                className="input-field"
                value={teachSearch}
                onChange={(e) => setTeachSearch(e.target.value)}
                placeholder={t('finance.searchPlaceholder')}
              />
            </div>

            {teachLoading ? (
              <div className="finance-loading">
                <Loader2 size={22} />
                {t('common.loading')}
              </div>
            ) : teachData.length === 0 ? (
              <div className="finance-empty">{t('finance.emptyTeachers')}</div>
            ) : (
              <div className="finance-table-shell">
                <div className="table-container">
                  <table className="data-table text-sm">
                    <thead>
                      <tr>
                        <th>{t('finance.user')}</th>
                        <th>{t('finance.walletBalance')}</th>
                        <th>{t('finance.coursesCount')}</th>
                        <th>{t('finance.enrollments')}</th>
                        <th>{t('finance.totalSales')}</th>
                        <th>{t('finance.teacherEarnings')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {teachData.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <UserCell user={{ full_name: row.full_name, email: row.email }} />
                          </td>
                          <td>
                            <span className="finance-balance-pill">
                              {row.wallet_balance} {row.wallet_currency}
                            </span>
                          </td>
                          <td>{row.courses_count}</td>
                          <td>{row.enrollment_count}</td>
                          <td className="font-medium">{Number(row.total_sales).toFixed(2)}</td>
                          <td>
                            <span className="finance-earnings">{Number(row.teacher_earnings).toFixed(2)}</span>
                          </td>
                          <td>
                            <Link to={`/teachers/${row.id}`} className="finance-link">
                              <ExternalLink size={14} />
                              {t('finance.openProfile')}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <FinancePagination
                  meta={teachMeta}
                  loading={teachLoading}
                  onPrev={() => setTeachPage((p) => p - 1)}
                  onNext={() => setTeachPage((p) => p + 1)}
                />
              </div>
            )}
          </div>
        </Card>
      )}

      <Modal
        isOpen={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title={t('finance.adjustWallet')}
        size="md"
      >
        {adjustTarget && (
          <form onSubmit={submitAdjust} className="p-4 space-y-4 text-sm">
            <div className="finance-modal-user">
              <div className="finance-modal-user-avatar">{userInitial(adjustTarget.full_name)}</div>
              <div>
                <div className="font-semibold text-base">{adjustTarget.full_name}</div>
                <span
                  className={`finance-badge mt-1 ${
                    adjustTarget.type === 'instructor'
                      ? 'finance-badge--instructor'
                      : 'finance-badge--student'
                  }`}
                >
                  {adjustTarget.type === 'instructor'
                    ? t('finance.instructor')
                    : t('finance.student')}
                </span>
              </div>
            </div>
            {adjustError && (
              <div className="text-red-600 text-sm p-2 rounded-lg bg-red-50 border border-red-100">
                {adjustError}
              </div>
            )}
            <Input
              label={t('finance.amount')}
              type="number"
              step="0.01"
              min="0"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              required
            />
            <div>
              <label className="input-label">{t('finance.operationType')}</label>
              <select
                className="input-field"
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value)}
              >
                <option value="deposit">{t('finance.deposit')}</option>
                <option value="withdraw">{t('finance.withdrawal')}</option>
                <option value="refund">{t('finance.refund')}</option>
              </select>
            </div>
            <Input
              label={t('finance.noteOptional')}
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
            />
            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="primary" loading={adjustLoading}>
                {t('common.submit')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setAdjustOpen(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default FinanceManagement;
