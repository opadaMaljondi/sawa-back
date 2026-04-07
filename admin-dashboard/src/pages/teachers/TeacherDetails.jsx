import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserCircle, Wallet, Shield, Video, Users, Layout, Pencil, Check } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { teachersAPI, permissionsAPI } from '../../services/api';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { formatDateTime } from '../../utils/date';
import '../students/StudentDetails.css';
import '../permissions/RolesAndPermissions.css';

const TeacherDetails = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [teacher, setTeacher] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingPerms, setSavingPerms] = useState(false);

  const [financial, setFinancial] = useState(null);
  const [financialLoading, setFinancialLoading] = useState(true);

  const [walletAmount, setWalletAmount] = useState('');
  const [walletType, setWalletType] = useState('withdraw');
  const [walletNote, setWalletNote] = useState('');
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');

  const [allPermissions, setAllPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const [permissions, setPermissions] = useState([]);

  /** نفس تجميع صفحة الأدوار: محتوى، مستخدمون، أكاديمي، أخرى */
  const permissionGroups = useMemo(() => {
    const groups = {
      content: { icon: <Video size={18} />, permissions: [] },
      users: { icon: <Users size={18} />, permissions: [] },
      academic: { icon: <Shield size={18} />, permissions: [] },
      other: { icon: <Layout size={18} />, permissions: [] },
    };

    allPermissions.forEach((perm) => {
      const n = perm.name || '';
      if (
        n.includes('video')
        || n.includes('note')
        || n.includes('exam')
        || n.includes('course')
        || n.includes('section')
        || n.includes('chat')
      ) {
        groups.content.permissions.push(perm);
      } else if (n.includes('student') || n.includes('instructor')) {
        groups.users.permissions.push(perm);
      } else if (
        n.includes('department')
        || n.includes('year')
        || n.includes('semester')
        || n.includes('subject')
      ) {
        groups.academic.permissions.push(perm);
      } else {
        groups.other.permissions.push(perm);
      }
    });

    return groups;
  }, [allPermissions]);

  const loadTeacher = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await teachersAPI.getById(id);
      setTeacher(res);
      const current = res.permissions?.map((p) => p.name) || [];
      setPermissions(current);
    } catch (e) {
      console.error(e);
      setError('فشل تحميل بيانات الأستاذ');
    } finally {
      setLoading(false);
    }
  };

  const loadFinancial = async () => {
    try {
      setFinancialLoading(true);
      const res = await teachersAPI.getWalletOverview(id);
      setFinancial(res);
    } catch (e) {
      console.error(e);
      setFinancial(null);
    } finally {
      setFinancialLoading(false);
    }
  };

  useEffect(() => {
    loadTeacher();
    loadFinancial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const load = async () => {
      try {
        setPermissionsLoading(true);
        const list = await permissionsAPI.getPermissions();
        setAllPermissions(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error(e);
        setAllPermissions([]);
      } finally {
        setPermissionsLoading(false);
      }
    };
    load();
  }, []);

  const togglePermission = (permName) => {
    setPermissions((prev) =>
      prev.includes(permName) ? prev.filter((p) => p !== permName) : [...prev, permName],
    );
  };

  const savePermissions = async () => {
    try {
      setSavingPerms(true);
      await teachersAPI.updatePermissions(teacher.id, { permissions });
      await loadTeacher();
    } catch (e) {
      console.error(e);
      alert('فشل حفظ الصلاحيات');
    } finally {
      setSavingPerms(false);
    }
  };

  const toggleSuspend = async () => {
    try {
      await teachersAPI.toggleSuspend(teacher.id);
      await loadTeacher();
    } catch (e) {
      console.error(e);
      alert('فشل تغيير حالة الأستاذ');
    }
  };

  const handleWalletSubmit = async (e) => {
    e.preventDefault();
    setWalletError('');
    const amount = Number(walletAmount);
    if (!amount || amount <= 0) {
      setWalletError('أدخل مبلغاً صالحاً');
      return;
    }
    try {
      setWalletLoading(true);
      await teachersAPI.updateWallet(id, {
        amount,
        type: walletType,
        note: walletNote.trim() || undefined,
      });
      setWalletAmount('');
      setWalletNote('');
      await loadFinancial();
    } catch (err) {
      console.error(err);
      setWalletError(err.response?.data?.message || 'فشل تنفيذ العملية على المحفظة');
    } finally {
      setWalletLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">جاري تحميل بيانات الأستاذ...</div>;
  }

  if (error || !teacher) {
    return <div className="p-6 text-sm text-red-600">{error || 'لم يتم العثور على الأستاذ'}</div>;
  }

  const avatarSrc = resolveMediaUrl(teacher.image_url);
  const courseRows = financial?.courses?.length ? financial.courses : teacher.courses || [];

  return (
    <div className="students-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('teachers.teacherDetails')}</h1>
          <p className="page-subtitle">{teacher.full_name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/teachers">
            <Button variant="outline">{t('common.back')}</Button>
          </Link>
          <Button
            type="button"
            variant="primary"
            icon={<Pencil size={18} />}
            onClick={() => navigate(`/teachers/${id}/edit`)}
          >
            {t('teachers.editTeacher')}
          </Button>
          <Button variant="outline" onClick={toggleSuspend}>
            {teacher.active ? 'إيقاف الأستاذ' : 'تفعيل الأستاذ'}
          </Button>
        </div>
      </div>

      <div className="dashboard-grid">
        <Card title={t('teachers.teacherDetails')}>
          <div className="p-4 student-details-profile">
            <div className="student-details-avatar-wrap">
              {avatarSrc ? (
                <img src={avatarSrc} alt="" className="student-details-avatar" />
              ) : (
                <div className="student-details-avatar student-details-avatar--placeholder" aria-hidden>
                  <UserCircle size={56} strokeWidth={1.25} />
                </div>
              )}
            </div>
            <div className="details-grid details-grid--with-avatar">
              <div className="detail-item">
                <span className="detail-label">الاسم الكامل</span>
                <span className="detail-value">{teacher.full_name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">البريد الإلكتروني</span>
                <span className="detail-value">{teacher.email || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">رقم الهاتف</span>
                <span className="detail-value">{teacher.phone || '—'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">الحالة</span>
                <span className={`status-badge status-${teacher.active ? 'active' : 'inactive'}`}>
                  {teacher.active ? t('common.active') : t('common.inactive')}
                </span>
              </div>
              <div className="detail-item detail-item--bio">
                <span className="detail-label">نبذة / السيرة</span>
                <span className="detail-value detail-bio-value">{teacher.bio?.trim() ? teacher.bio : '—'}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card title="المحفظة">
          <div className="p-4 text-sm space-y-3">
            <div className="flex items-center gap-2 text-gray-700">
              <Wallet size={18} />
              <span>رصيد قابل للسحب (يُدار من لوحة التحكم)</span>
            </div>
            {financialLoading ? (
              <p className="text-gray-500">جاري تحميل المحفظة...</p>
            ) : (
              <>
                <p>
                  <span className="detail-label">الرصيد الحالي </span>
                  <span className="detail-value font-semibold">
                    {financial?.wallet?.balance ?? 0} {financial?.wallet?.currency || 'SYP'}
                  </span>
                </p>
                {financial?.totals && (
                  <div className="p-2 bg-gray-50 rounded text-xs space-y-1">
                    <p>
                      إجمالي مبيعات كورساته (نشطة):{' '}
                      <strong>{Number(financial.totals.total_sales).toFixed(2)}</strong>
                    </p>
                    <p>
                      أرباح الأستاذ المحتسبة من المبيعات (بعد عمولة الإدارة):{' '}
                      <strong className="text-blue-800">
                        {Number(financial.totals.total_teacher_earnings).toFixed(2)}
                      </strong>
                    </p>
                  </div>
                )}
                <form onSubmit={handleWalletSubmit} className="space-y-2 pt-2 border-t border-gray-100">
                  {walletError && <div className="text-xs text-red-600">{walletError}</div>}
                  <Input
                    label="المبلغ"
                    type="number"
                    min="0"
                    step="0.01"
                    value={walletAmount}
                    onChange={(e) => setWalletAmount(e.target.value)}
                    fullWidth
                    required
                  />
                  <div>
                    <label className="input-label">نوع العملية</label>
                    <select
                      className="input-field"
                      value={walletType}
                      onChange={(e) => setWalletType(e.target.value)}
                    >
                      <option value="deposit">إيداع / إضافة رصيد</option>
                      <option value="withdraw">سحب من المحفظة</option>
                      <option value="refund">استرداد للرصيد (زيادة)</option>
                    </select>
                  </div>
                  <Input
                    label="ملاحظة (اختياري)"
                    value={walletNote}
                    onChange={(e) => setWalletNote(e.target.value)}
                    fullWidth
                  />
                  <Button type="submit" variant="primary" loading={walletLoading}>
                    تنفيذ العملية
                  </Button>
                </form>
                {financial?.transactions?.length > 0 && (
                  <div className="pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-600 mb-2">آخر الحركات</p>
                    <div className="table-container max-h-48 overflow-y-auto">
                      <table className="data-table text-xs">
                        <thead>
                          <tr>
                            <th>النوع</th>
                            <th>المبلغ</th>
                            <th>الرصيد بعد</th>
                            <th>التاريخ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {financial.transactions.map((tx) => (
                            <tr key={tx.id}>
                              <td>{tx.type}</td>
                              <td>{tx.amount}</td>
                              <td>{tx.balance_after}</td>
                              <td>{formatDateTime(tx.created_at, i18n.language)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      <Card title="الكورسات والأرباح">
        <div className="p-4">
          {financialLoading && !courseRows.length ? (
            <p className="text-sm text-gray-500">جاري تحميل الكورسات...</p>
          ) : !courseRows.length ? (
            <p className="text-sm text-gray-500">لا توجد كورسات.</p>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>العنوان</th>
                    <th>المادة</th>
                    <th>سعر الكورس</th>
                    <th>الحالة</th>
                    <th>اشتراكات</th>
                    <th>إجمالي المبيعات</th>
                    <th>ربح الأستاذ</th>
                  </tr>
                </thead>
                <tbody>
                  {courseRows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/courses/${c.id}`} className="text-blue-600 hover:underline font-medium">
                          {c.title}
                        </Link>
                      </td>
                      <td>{c.subject?.name ?? '—'}</td>
                      <td>{c.price ?? '—'}</td>
                      <td>{c.status ?? '—'}</td>
                      <td>{c.enrollment_count ?? '—'}</td>
                      <td>
                        {c.total_sales != null ? Number(c.total_sales).toFixed(2) : '—'}
                      </td>
                      <td className="font-medium text-blue-800">
                        {c.teacher_earnings != null ? Number(c.teacher_earnings).toFixed(2) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-3">
            يُحسب ربح الأستاذ من المبيعات الفعلية (اشتراكات نشطة) بعد خصم نسبة عمولة الإدارة لكل كورس.
          </p>
        </div>
      </Card>

      <Card title={t('teachers.instructorPermissions')}>
        <div className="p-4 space-y-4 text-sm">
          <p className="text-gray-600">
            يتم جلب كل الصلاحيات المعرفة في النظام من الخادم. حدد ما يُسمح لهذا الأستاذ بفعله (أسماء الصلاحيات كما في قاعدة البيانات).
          </p>
          {permissionsLoading ? (
            <p className="text-gray-500">{t('common.loading')}</p>
          ) : !allPermissions.length ? (
            <p className="text-amber-600">تعذر تحميل قائمة الصلاحيات.</p>
          ) : (
            <div className="permissions-selector teacher-permissions-selector">
              {Object.keys(permissionGroups).map((groupKey) => {
                const group = permissionGroups[groupKey];
                if (!group.permissions.length) return null;
                return (
                  <div key={groupKey} className="perm-group">
                    <h4 className="group-title">
                      {group.icon}
                      {t(`permissions.groups.${groupKey}`) || groupKey}
                    </h4>
                    <div className="perms-list">
                      {group.permissions.map((perm) => (
                        <label key={perm.id} className="perm-item">
                          <div className="checkbox-wrapper">
                            <input
                              type="checkbox"
                              checked={permissions.includes(perm.name)}
                              onChange={() => togglePermission(perm.name)}
                            />
                            <span className="checkmark">
                              <Check size={12} />
                            </span>
                          </div>
                          <span className="perm-name">{perm.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Button
            variant="primary"
            onClick={savePermissions}
            loading={savingPerms}
            disabled={permissionsLoading || !allPermissions.length}
          >
            {t('common.save')}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default TeacherDetails;
