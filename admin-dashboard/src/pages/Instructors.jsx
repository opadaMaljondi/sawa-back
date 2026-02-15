import { useEffect, useState } from 'react'
import api from '../api/axios'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function Instructors() {
  const [data, setData] = useState({ data: [], current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' })
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchList = () => {
    setLoading(true)
    api.get('/admin/instructors', { params: { page } })
      .then((res) => setData(res.data))
      .catch(() => setData({ data: [], current_page: 1, last_page: 1 }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchList()
  }, [page])

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitError('')
    setSubmitting(true)
    api.post('/admin/instructors', form)
      .then(() => {
        setModal(false)
        setForm({ full_name: '', email: '', phone: '', password: '' })
        fetchList()
      })
      .catch((err) => setSubmitError(err.response?.data?.message || 'فشل الحفظ'))
      .finally(() => setSubmitting(false))
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('ar-IQ') : '—'

  return (
    <div className="space-y-6">
      <PageHeader
        title="المعلمون"
        subtitle="إدارة حسابات المعلمين"
        action={
          <Button onClick={() => { setModal(true); setSubmitError(''); }}>
            إضافة معلم
          </Button>
        }
      />
      <Card>
        {loading ? (
          <Loading />
        ) : !data.data?.length ? (
          <EmptyState title="لا يوجد معلمون" description="أضف معلم من الزر أعلاه." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الاسم</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">البريد</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الهاتف</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الكورسات</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">التسجيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-medium text-slate-800">{u.full_name}</td>
                      <td className="py-4 px-6 text-slate-600">{u.email}</td>
                      <td className="py-4 px-6 text-slate-600">{u.phone || '—'}</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2.5 py-1 rounded-lg bg-primary-100 text-primary-700 text-sm font-medium">
                          {u.courses?.length ?? 0}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-500 text-sm">{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.last_page > 1 && (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-slate-100">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</Button>
                <span className="text-sm text-slate-600 px-2">{data.current_page} / {data.last_page}</span>
                <Button variant="secondary" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)}>التالي</Button>
              </div>
            )}
          </>
        )}
      </Card>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !submitting && setModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg text-slate-800 mb-4">إضافة معلم</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && <p className="text-red-600 text-sm">{submitError}</p>}
              <Input label="الاسم الكامل" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} required />
              <Input label="البريد" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
              <Input label="الهاتف" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required />
              <Input label="كلمة المرور" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={6} />
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={submitting}>{submitting ? 'جاري الحفظ...' : 'حفظ'}</Button>
                <Button type="button" variant="secondary" onClick={() => setModal(false)} disabled={submitting}>إلغاء</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
