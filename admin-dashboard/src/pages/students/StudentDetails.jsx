import React, { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-qr-code';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { UserCircle } from 'lucide-react';
import { studentsAPI } from '../../services/api';
import { buildStudentWalletQrUrl } from '../../utils/studentWalletQr';
import { formatDateTime } from '../../utils/date';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import './StudentDetails.css';

function walletTransactionTypeLabel(type, t) {
  switch (type) {
    case 'deposit':
      return t('students.walletTxTypeDeposit');
    case 'withdrawal':
      return t('students.walletTxTypeWithdrawal');
    case 'refund':
      return t('students.walletTxTypeRefund');
    default:
      return type || t('students.walletTxTypeOther');
  }
}

const StudentDetails = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletType, setWalletType] = useState('deposit');
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');

  const loadStudent = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await studentsAPI.getById(id);
      setStudent(res);
    } catch (e) {
      console.error(e);
      setError('فشل تحميل بيانات الطالب');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!student) return;
    if (searchParams.get('wallet') !== '1') return;
    const action = searchParams.get('action');
    if (action === 'deposit' || action === 'withdraw') {
      setWalletType(action);
    }
    const el = document.getElementById('student-wallet-card');
    requestAnimationFrame(() => el?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [student, searchParams, id]);

  const handleWalletSubmit = async (e) => {
    e.preventDefault();
    setWalletError('');
    const amount = Number(walletAmount);
    if (!amount || amount <= 0) {
      setWalletError('أدخل مبلغ صالحاً');
      return;
    }
    try {
      setWalletLoading(true);
      await studentsAPI.updateWallet(student.id, {
        amount,
        type: walletType,
      });
      setWalletAmount('');
      await loadStudent();
    } catch (err) {
      console.error(err);
      setWalletError(err.response?.data?.message || 'فشل تحديث المحفظة');
    } finally {
      setWalletLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">جاري تحميل بيانات الطالب...</div>;
  }

  if (error || !student) {
    return <div className="p-6 text-sm text-red-600">{error || 'لم يتم العثور على الطالب'}</div>;
  }

  const avatarSrc = resolveMediaUrl(student.image_url);

  return (
    <div className="students-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('students.studentDetails')}</h1>
          <p className="page-subtitle">{student.full_name}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/students">
            <Button variant="outline">{t('common.back')}</Button>
          </Link>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await studentsAPI.toggleBan(student.id);
                await loadStudent();
              } catch (e) {
                console.error(e);
                alert('فشل تغيير حالة الطالب');
              }
            }}
          >
            {student.active ? 'حظر الطالب' : 'إلغاء الحظر'}
          </Button>
        </div>
      </div>

      <div className="dashboard-grid">
        <Card title={t('students.studentDetails')}>
          <div className="p-4 student-details-profile">
            <div className="student-details-avatar-wrap">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt=""
                  className="student-details-avatar"
                />
              ) : (
                <div className="student-details-avatar student-details-avatar--placeholder" aria-hidden>
                  <UserCircle size={56} strokeWidth={1.25} />
                </div>
              )}
            </div>
            <div className="details-grid details-grid--with-avatar">
            <div className="detail-item">
              <span className="detail-label">الاسم الكامل</span>
              <span className="detail-value">{student.full_name}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">البريد الإلكتروني</span>
              <span className="detail-value">{student.email || '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">رقم الهاتف</span>
              <span className="detail-value">{student.phone || '—'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">الحالة</span>
              <span className={`status-badge status-${student.active ? 'active' : 'inactive'}`}>
                {student.active ? t('common.active') : t('common.inactive')}
              </span>
            </div>
            </div>
          </div>
        </Card>

        <Card title="المحفظة" className="student-wallet-card-wrap">
          <div id="student-wallet-card" className="p-4 text-sm space-y-3">
            <p>
              <span className="detail-label">الرصيد الحالي</span>{' '}
              <span className="detail-value">{student.wallet?.balance ?? 0}</span>
            </p>

            <div className="student-wallet-qr-block">
              <p className="student-wallet-qr-intro">{t('students.walletQrIntroSingle')}</p>
              <div className="student-wallet-qr-single">
                <div className="student-wallet-qr-canvas">
                  <QRCode value={buildStudentWalletQrUrl(student.id)} size={168} level="M" />
                </div>
              </div>
            </div>

            <form onSubmit={handleWalletSubmit} className="space-y-2">
              {walletError && <div className="text-xs text-red-600">{walletError}</div>}
              <Input
                label="المبلغ"
                type="number"
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
                  <option value="deposit">إيداع (شحن رصيد)</option>
                  <option value="withdraw">سحب</option>
                </select>
              </div>
              <Button type="submit" variant="primary" loading={walletLoading}>
                تنفيذ العملية
              </Button>
            </form>
          </div>
        </Card>
      </div>

      <Card title={t('students.walletTransactionsTitle')}>
        <div className="p-4">
          {!student.wallet?.transactions?.length ? (
            <p className="text-sm text-gray-500">{t('students.walletTxEmpty')}</p>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('students.walletTxDate')}</th>
                    <th>{t('students.walletTxType')}</th>
                    <th>{t('students.walletTxAmount')}</th>
                    <th>{t('students.walletTxBalanceAfter')}</th>
                    <th>{t('students.walletTxTitle')}</th>
                    <th>{t('students.walletTxRef')}</th>
                  </tr>
                </thead>
                <tbody>
                  {student.wallet.transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>{formatDateTime(tx.created_at, i18n.language)}</td>
                      <td>{walletTransactionTypeLabel(tx.type, t)}</td>
                      <td>
                        <span
                          className={
                            Number(tx.amount) >= 0
                              ? 'student-wallet-tx-amt student-wallet-tx-amt--in'
                              : 'student-wallet-tx-amt student-wallet-tx-amt--out'
                          }
                        >
                          {Number(tx.amount).toLocaleString(i18n.language)}
                        </span>
                      </td>
                      <td>{tx.balance_after != null ? Number(tx.balance_after).toLocaleString(i18n.language) : '—'}</td>
                      <td>{tx.title || tx.description || '—'}</td>
                      <td className="text-xs text-gray-600">{tx.transaction_number || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <Card title="الاشتراكات">
        <div className="p-4">
          {!student.enrollments?.length ? (
            <p className="text-sm text-gray-500">لا توجد اشتراكات.</p>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الكورس</th>
                    <th>النوع</th>
                    <th>السعر النهائي</th>
                    <th>تاريخ الاشتراك</th>
                  </tr>
                </thead>
                <tbody>
                  {student.enrollments.map((e) => (
                    <tr key={e.id}>
                      <td>{e.course?.title}</td>
                      <td>{e.type}</td>
                      <td>{e.final_price}</td>
                      <td>{formatDateTime(e.enrolled_at, i18n.language)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default StudentDetails;

