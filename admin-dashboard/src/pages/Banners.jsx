import { useEffect, useState } from 'react'
import api from '../api/axios'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function Banners() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ title: '', link_type: 'none', link_url: '', order: 1 })
  const [imageFile, setImageFile] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const fetchList = () => {
    setLoading(true)
    api.get('/admin/banners')
      .then((res) => setList(Array.isArray(res.data) ? res.data : []))
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchList() }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitError('')
    if (!imageFile && !form.title) {
      setSubmitError('أضف عنواناً أو صورة')
      return
    }
    setSubmitting(true)
    const fd = new FormData()
    fd.append('title', form.title)
    fd.append('link_type', form.link_type)
    fd.append('order', form.order)
    if (form.link_url) fd.append('link_url', form.link_url)
    if (imageFile) fd.append('image', imageFile)
    api.post('/admin/banners', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(() => { setModal(false); setForm({ title: '', link_type: 'none', link_url: '', order: 1 }); setImageFile(null); fetchList() })
      .catch((err) => setSubmitError(err.response?.data?.message || 'فشل الحفظ'))
      .finally(() => setSubmitting(false))
  }

  const handleDelete = (id) => {
    if (!confirm('حذف هذا البانر؟')) return
    api.delete(`/admin/banners/${id}`).then(() => fetchList()).catch(() => {})
  }

  const baseUrl = import.meta.env.VITE_API_URL || '/api'
  const storageUrl = baseUrl.replace('/api', '') + '/storage/'

  return (
    <div className="space-y-6">
      <PageHeader title="البانرات" subtitle="إدارة بانرات الصفحة الرئيسية" action={<Button onClick={() => { setModal(true); setSubmitError(''); }}>إضافة بانر</Button>} />
      <Card>
        {loading ? <Loading /> : !list.length ? <EmptyState title="لا توجد بانرات" /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الصورة</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">العنوان</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الترتيب</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-6">
                      {b.image_path ? (
                        <img src={storageUrl + b.image_path} alt="" className="w-24 h-14 object-cover rounded-lg" />
                      ) : <span className="text-slate-400 text-sm">—</span>}
                    </td>
                    <td className="py-4 px-6 font-medium text-slate-800">{b.title || '—'}</td>
                    <td className="py-4 px-6 text-slate-600">{b.order ?? 0}</td>
                    <td className="py-4 px-6">
                      <Button variant="danger" className="!py-1.5 !text-xs" onClick={() => handleDelete(b.id)}>حذف</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !submitting && setModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg text-slate-800 mb-4">إضافة بانر</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && <p className="text-red-600 text-sm">{submitError}</p>}
              <Input label="العنوان" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الصورة</label>
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">نوع الرابط</label>
                <select value={form.link_type} onChange={(e) => setForm((f) => ({ ...f, link_type: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none">
                  <option value="none">بدون</option>
                  <option value="url">رابط خارجي</option>
                  <option value="course">كورس</option>
                  <option value="subject">مادة</option>
                </select>
              </div>
              {form.link_type === 'url' && <Input label="الرابط" value={form.link_url} onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))} placeholder="https://..." />}
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
