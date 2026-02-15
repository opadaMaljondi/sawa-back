import { useEffect, useState } from 'react'
import api from '../api/axios'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function Subjects() {
  const [data, setData] = useState({ data: [], current_page: 1, last_page: 1 })
  const [departments, setDepartments] = useState([])
  const [years, setYears] = useState([])
  const [semesters, setSemesters] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ department_id: '', year_id: '', semester_id: '', name: '', description: '' })
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchList = () => {
    setLoading(true)
    const params = { page, per_page: 20 }
    if (departmentFilter) params.department_id = departmentFilter
    api.get('/admin/subjects', { params })
      .then((res) => setData({ data: res.data?.data ?? res.data ?? [], current_page: res.data?.current_page ?? 1, last_page: res.data?.last_page ?? 1 }))
      .catch(() => setData({ data: [], current_page: 1, last_page: 1 }))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchList()
  }, [page, departmentFilter])

  useEffect(() => {
    api.get('/admin/departments', { params: { per_page: 100 } }).then((res) => setDepartments(res.data?.data ?? res.data ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (form.department_id) {
      api.get('/admin/years', { params: { department_id: form.department_id, per_page: 100 } }).then((res) => setYears(res.data?.data ?? res.data ?? [])).catch(() => setYears([]))
    } else setYears([])
  }, [form.department_id])

  useEffect(() => {
    if (form.year_id) {
      api.get('/admin/semesters', { params: { year_id: form.year_id, per_page: 100 } }).then((res) => setSemesters(res.data?.data ?? res.data ?? [])).catch(() => setSemesters([]))
    } else setSemesters([])
  }, [form.year_id])

  const openCreate = () => {
    setEditingId(null)
    setForm({ department_id: departments[0]?.id ?? '', year_id: '', semester_id: '', name: '', description: '' })
    setSubmitError('')
    setModal(true)
  }

  const openEdit = (s) => {
    setEditingId(s.id)
    setForm({ department_id: s.department_id, year_id: s.year_id ?? '', semester_id: s.semester_id ?? '', name: s.name ?? '', description: s.description ?? '' })
    setSubmitError('')
    setModal(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitError('')
    setSubmitting(true)
    const payload = { ...form, department_id: Number(form.department_id), year_id: Number(form.year_id), semester_id: Number(form.semester_id) }
    const req = editingId ? api.put(`/admin/subjects/${editingId}`, payload) : api.post('/admin/subjects', payload)
    req.then(() => { setModal(false); fetchList(); })
      .catch((err) => setSubmitError(err.response?.data?.message || 'فشل الحفظ'))
      .finally(() => setSubmitting(false))
  }

  const handleDelete = (id) => {
    if (!confirm('حذف هذه المادة؟')) return
    api.delete(`/admin/subjects/${id}`).then(() => fetchList()).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <PageHeader title="المواد" subtitle="إدارة المواد الدراسية" action={<Button onClick={openCreate}>إضافة مادة</Button>} />
      <div className="flex gap-3">
        <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none">
          <option value="">كل الأقسام</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <Card>
        {loading ? <Loading /> : !data.data?.length ? <EmptyState title="لا توجد مواد" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الاسم</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">القسم</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">السنة</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الفصل</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-medium text-slate-800">{s.name}</td>
                      <td className="py-4 px-6 text-slate-600">{s.department?.name ?? '—'}</td>
                      <td className="py-4 px-6 text-slate-600">{s.year?.name ?? '—'}</td>
                      <td className="py-4 px-6 text-slate-600">{s.semester?.name ?? '—'}</td>
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
            <h3 className="font-display font-bold text-lg text-slate-800 mb-4">{editingId ? 'تعديل المادة' : 'إضافة مادة'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && <p className="text-red-600 text-sm">{submitError}</p>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">القسم</label>
                <select value={form.department_id} onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value, year_id: '', semester_id: '' }))} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none">
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">السنة</label>
                <select value={form.year_id} onChange={(e) => setForm((f) => ({ ...f, year_id: e.target.value, semester_id: '' }))} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none">
                  <option value="">اختر السنة</option>
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الفصل</label>
                <select value={form.semester_id} onChange={(e) => setForm((f) => ({ ...f, semester_id: e.target.value }))} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none">
                  <option value="">اختر الفصل</option>
                  {semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <Input label="اسم المادة" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الوصف</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none resize-none" rows={2} />
              </div>
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
