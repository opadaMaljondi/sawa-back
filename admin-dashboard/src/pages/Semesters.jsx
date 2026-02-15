import { useEffect, useState } from 'react'
import api from '../api/axios'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function Semesters() {
  const [data, setData] = useState({ data: [], current_page: 1, last_page: 1 })
  const [years, setYears] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [yearFilter, setYearFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ year_id: '', name: '', order: 0 })
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchList = () => {
    setLoading(true)
    const params = { page, per_page: 20 }
    if (yearFilter) params.year_id = yearFilter
    api.get('/admin/semesters', { params })
      .then((res) => setData({ data: res.data?.data ?? res.data ?? [], current_page: res.data?.current_page ?? 1, last_page: res.data?.last_page ?? 1 }))
      .catch(() => setData({ data: [], current_page: 1, last_page: 1 }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchList()
  }, [page, yearFilter])

  useEffect(() => {
    api.get('/admin/years', { params: { per_page: 100 } })
      .then((res) => setYears(res.data?.data ?? res.data ?? []))
      .catch(() => {})
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ year_id: years[0]?.id ?? '', name: '', order: 0 })
    setSubmitError('')
    setModal(true)
  }

  const openEdit = (s) => {
    setEditingId(s.id)
    setForm({ year_id: s.year_id, name: s.name ?? '', order: s.order ?? 0 })
    setSubmitError('')
    setModal(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitError('')
    setSubmitting(true)
    const payload = { ...form, year_id: Number(form.year_id), order: Number(form.order) || 0 }
    const req = editingId ? api.put(`/admin/semesters/${editingId}`, payload) : api.post('/admin/semesters', payload)
    req.then(() => { setModal(false); fetchList(); })
      .catch((err) => setSubmitError(err.response?.data?.message || 'فشل الحفظ'))
      .finally(() => setSubmitting(false))
  }

  const handleDelete = (id) => {
    if (!confirm('حذف هذا الفصل؟')) return
    api.delete(`/admin/semesters/${id}`).then(() => fetchList()).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <PageHeader title="الفصول الدراسية" subtitle="إدارة الفصول (سمسترات)" action={<Button onClick={openCreate}>إضافة فصل</Button>} />
      <div className="flex gap-3">
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none">
          <option value="">كل السنوات</option>
          {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
        </select>
      </div>
      <Card>
        {loading ? <Loading /> : !data.data?.length ? <EmptyState title="لا توجد فصول" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الاسم</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">السنة</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الترتيب</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-medium text-slate-800">{s.name}</td>
                      <td className="py-4 px-6 text-slate-600">{s.year?.name ?? '—'}</td>
                      <td className="py-4 px-6 text-slate-600">{s.order ?? 0}</td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" className="!py-1.5 !text-xs" onClick={() => openEdit(s)}>تعديل</Button>
                          <Button variant="danger" className="!py-1.5 !text-xs" onClick={() => handleDelete(s.id)}>حذف</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.last_page > 1 && (
              <div className="flex justify-center gap-2 py-4 border-t border-slate-100">
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
            <h3 className="font-display font-bold text-lg text-slate-800 mb-4">{editingId ? 'تعديل الفصل' : 'إضافة فصل'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && <p className="text-red-600 text-sm">{submitError}</p>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">السنة</label>
                <select value={form.year_id} onChange={(e) => setForm((f) => ({ ...f, year_id: e.target.value }))} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none">
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
              <Input label="الاسم" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              <Input label="الترتيب" type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))} />
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
