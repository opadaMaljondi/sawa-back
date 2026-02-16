import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { studentsAPI } from '../../services/api';
import { formatDateTime } from '../../utils/date';
import './StudentDetails.css';

const StudentDetails = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
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
          <div className="p-4 details-grid">
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
        </Card>

        <Card title="المحفظة">
          <div className="p-4 text-sm space-y-3">
            <p>
              <span className="detail-label">الرصيد الحالي</span>{' '}
              <span className="detail-value">{student.wallet?.balance ?? 0}</span>
            </p>
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

