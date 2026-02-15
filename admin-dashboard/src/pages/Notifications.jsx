import { useEffect, useState } from 'react'
import api from '../api/axios'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function Notifications() {
  const [scope, setScope] = useState('general')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [departments, setDepartments] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/departments').then((res) => setDepartments(Array.isArray(res.data) ? res.data : res.data?.data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (scope === 'course') {
      api.get('/admin/courses', { params: { per_page: 200 } }).then((res) => setCourses(res.data?.data || res.data || [])).catch(() => setCourses([]))
    }
  }, [scope])

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setResult(null)
    setLoading(true)
    const body = { scope, title, message }
    if (scope === 'department') body.department_id = Number(departmentId)
    if (scope === 'course') body.course_id = Number(courseId)
    api.post('/admin/notifications/send', body)
      .then((res) => setResult(res.data))
      .catch((err) => setError(err.response?.data?.message || 'فشل الإرسال'))
      .finally(() => setLoading(false))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإشعارات"
        subtitle="إرسال إشعار عام أو حسب القسم أو الكورس"
      />
      <Card className="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {result && (
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 text-sm">
              تم الإرسال. عدد المستلمين: {result.stored_count}، FCM: {result.fcm_sent ? 'نعم' : 'لا'}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">نوع الإشعار</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
            >
              <option value="general">عام (كل المستخدمين)</option>
              <option value="department">طلاب فرع محدد</option>
              <option value="course">مشتركو كورس معين</option>
            </select>
          </div>
          {scope === 'department' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">القسم</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
              >
                <option value="">اختر القسم</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          {scope === 'course' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">الكورس</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
              >
                <option value="">اختر الكورس</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
          )}
          <Input label="العنوان" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="عنوان الإشعار" />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">النص</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none resize-none"
              placeholder="محتوى الإشعار"
            />
          </div>
          <Button type="submit" disabled={loading}>{loading ? 'جاري الإرسال...' : 'إرسال الإشعار'}</Button>
        </form>
      </Card>
    </div>
  )
}
