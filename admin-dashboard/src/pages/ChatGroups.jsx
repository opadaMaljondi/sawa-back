import { useEffect, useState } from 'react'
import api from '../api/axios'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'

export default function ChatGroups() {
  const [data, setData] = useState({ data: [], current_page: 1, last_page: 1 })
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [courseFilter, setCourseFilter] = useState('')

  const fetchList = () => {
    setLoading(true)
    const params = { page }
    if (courseFilter) params.course_id = courseFilter
    api.get('/admin/chat-groups', { params })
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

  const handleDelete = (id) => {
    if (!confirm('حذف مجموعة الدردشة؟')) return
    api.delete(`/admin/chat-groups/${id}`).then(() => fetchList()).catch(() => {})
  }

  return (
    <div className="space-y-6">
      <PageHeader title="مجموعات الدردشة" subtitle="مجموعات دردشة الكورسات" />
      <div className="flex gap-3">
        <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none min-w-[200px]">
          <option value="">كل الكورسات</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      <Card>
        {loading ? <Loading /> : !data.data?.length ? <EmptyState title="لا توجد مجموعات دردشة" /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الاسم</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الكورس</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">المشاركون</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((ch) => (
                    <tr key={ch.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-medium text-slate-800">{ch.name}</td>
                      <td className="py-4 px-6 text-slate-600">{ch.course?.title ?? '—'}</td>
                      <td className="py-4 px-6 text-slate-600">{ch.participants?.length ?? 0}</td>
                      <td className="py-4 px-6">
                        <Button variant="danger" className="!py-1.5 !text-xs" onClick={() => handleDelete(ch.id)}>حذف</Button>
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
    </div>
  )
}
