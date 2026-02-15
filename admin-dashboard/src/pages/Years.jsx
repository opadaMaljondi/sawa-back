import { useEffect, useState } from 'react'
import api from '../api/axios'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function Years() {
  const [data, setData] = useState({ data: [], current_page: 1, last_page: 1 })
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ department_id: '', name: '', order: 0 })
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchList = () => {
    setLoading(true)
    const params = { page, per_page: 20 }
    if (departmentFilter) params.department_id = departmentFilter
    api.get('/admin/years', { params })
      .then((res) => {
        const d = res.data
        setData({ data: d?.data ?? d ?? [], current_page: d?.current_page ?? 1, last_page: d?.last_page ?? 1 })
      })
      .catch(() => setData({ data: [], current_page: 1, last_page: 1 }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchList() }, [page, departmentFilter])
  useEffect(() => {
    api.get('/admin/departments', { params: { per_page: 100 } })
      .then((res) => setDepartments(res.data?.data ?? res.data ?? []))
      .catch(() => {})
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ department_id: departments[0]?.id ?? '', name: '', order: 0 })
    setSubmitError('')
    setModal(true)
  }

  const openEdit = (y) => {
    setEditingId(y.id)
    setForm({ department_id: y.department_id, name: y.name ?? '', order: y.order ?? 0 })
    setSubmitError('')
    setModal(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitError('')
    setSubmitting(true)
    const payload = { ...form, department_id: Number(form.department_id), order: Number(form.order) || 0 }
    const req = editingId ? api.put(`/admin/years/${editingId}`, payload) : api.post('/admin/years', payload)
    req.then(() => { setModal(false); fetchList() })
      .catch((err) => setSubmitError(err.response?.data?.message || 'فشل الحفظ'))
      .finally(() => setSubmitting(false))
  }

  const handleDelete = (id) => {
    if (!confirm('حذف هذه السنة؟')) return
    api.delete(`/admin/years/${id}`).then(() => fetchList()).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <PageHeader title="السنوات" subtitle="إدارة السنوات الدراسية" action={<Button onClick={openCreate}>إضافة سنة</Button>} />
      <div className="flex gap-3">
        <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none">
          <option value="">كل الأقسام</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <Card>
        {loading ? <Loading /> : !data.data?.length ? <EmptyState title="لا توجد سنوات" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الاسم</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">القسم</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الترتيب</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((y) => (
                    <tr key={y.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-medium text-slate-800">{y.name}</td>
                      <td className="py-4 px-6 text-slate-600">{y.department?.name ?? '—'}</td>
                      <td className="py-4 px-6 text-slate-600">{y.order ?? 0}</td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" className="!py-1.5 !text-xs" onClick={() => openEdit(y)}>تعديل</Button>
                          <Button variant="danger" className="!py-1.5 !text-xs" onClick={() => handleDelete(y.id)}>حذف</Button>
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
            <h3 className="font-display font-bold text-lg text-slate-800 mb-4">{editingId ? 'تعديل السنة' : 'إضافة سنة'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && <p className="text-red-600 text-sm">{submitError}</p>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">القسم</label>
                <select value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none">
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
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
