import { useEffect, useState } from 'react'
import api from '../api/axios'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function CourseSections() {
  const [data, setData] = useState({ data: [], current_page: 1, last_page: 1 })
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [courseFilter, setCourseFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ course_id: '', title: '', description: '', order: 1, price: '' })
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchList = () => {
    setLoading(true)
    const params = { page, per_page: 20 }
    if (courseFilter) params.course_id = courseFilter
    api.get('/admin/course-sections', { params })
      .then((res) => {
        const d = res.data
        setData({ data: d?.data ?? d ?? [], current_page: d?.current_page ?? 1, last_page: d?.last_page ?? 1 })
      })
      .catch(() => setData({ data: [], current_page: 1, last_page: 1 }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchList() }, [page, courseFilter])
  useEffect(() => {
    api.get('/admin/courses', { params: { per_page: 200 } }).then((res) => setCourses(res.data?.data ?? res.data ?? [])).catch(() => {})
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ course_id: (courseFilter || courses[0]?.id) ?? '', title: '', description: '', order: 1, price: '' })
    setSubmitError('')
    setModal(true)
  }

  const openEdit = (s) => {
    setEditingId(s.id)
    setForm({ course_id: s.course_id, title: s.title ?? '', description: s.description ?? '', order: s.order ?? 1, price: s.price ?? '' })
    setSubmitError('')
    setModal(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitError('')
    setSubmitting(true)
    const payload = { ...form, course_id: Number(form.course_id), order: Number(form.order) || 1, price: form.price ? Number(form.price) : null }
    const req = editingId ? api.put(`/admin/course-sections/${editingId}`, payload) : api.post('/admin/course-sections', payload)
    req.then(() => { setModal(false); fetchList() })
      .catch((err) => setSubmitError(err.response?.data?.message || 'فشل الحفظ'))
      .finally(() => setSubmitting(false))
  }

  const handleDelete = (id) => {
    if (!confirm('حذف هذه الوحدة؟')) return
    api.delete(`/admin/course-sections/${id}`).then(() => fetchList()).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <PageHeader title="وحدات الكورسات" subtitle="إدارة وحدات كل كورس" action={<Button onClick={openCreate}>إضافة وحدة</Button>} />
      <div className="flex gap-3">
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none min-w-[200px]">
          <option value="">كل الكورسات</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      <Card>
        {loading ? <Loading /> : !data.data?.length ? <EmptyState title="لا توجد وحدات" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">العنوان</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الكورس</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الترتيب</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">السعر</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-medium text-slate-800">{s.title}</td>
                      <td className="py-4 px-6 text-slate-600">{s.course?.title ?? '—'}</td>
                      <td className="py-4 px-6 text-slate-600">{s.order ?? 0}</td>
                      <td className="py-4 px-6 text-slate-600">{s.price != null ? s.price : '—'}</td>
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
            <h3 className="font-display font-bold text-lg text-slate-800 mb-4">{editingId ? 'تعديل الوحدة' : 'إضافة وحدة'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && <p className="text-red-600 text-sm">{submitError}</p>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الكورس</label>
                <select value={form.course_id} onChange={(e) => setForm((f) => ({ ...f, course_id: e.target.value }))} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none">
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
              <Input label="عنوان الوحدة" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الوصف</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none resize-none" rows={2} />
              </div>
              <Input label="الترتيب" type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))} />
              <Input label="سعر الوحدة (اختياري)" type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
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
