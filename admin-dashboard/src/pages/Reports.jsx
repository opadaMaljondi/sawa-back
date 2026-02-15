import { useEffect, useState } from 'react'
import api from '../api/axios'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'

export default function Reports() {
  const [revenue, setRevenue] = useState([])
  const [coursePerf, setCoursePerf] = useState([])
  const [instructorPerf, setInstructorPerf] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/admin/reports/revenue'),
      api.get('/admin/reports/course-performance'),
      api.get('/admin/reports/instructor-performance'),
    ])
      .then(([r1, r2, r3]) => {
        setRevenue(Array.isArray(r1.data) ? r1.data : [])
        setCoursePerf(Array.isArray(r2.data) ? r2.data : [])
        setInstructorPerf(Array.isArray(r3.data) ? r3.data : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const formatMoney = (n) => (n != null ? new Intl.NumberFormat('ar-IQ').format(Number(n)) : '—')

  if (loading) return <Loading className="min-h-[40vh]" />

  return (
    <div className="space-y-8">
      <PageHeader title="التقارير" subtitle="تقارير الإيرادات وأداء الكورسات والمعلمين" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="تقرير الإيرادات (حسب اليوم)">
          <div className="p-6">
          {!revenue.length ? <EmptyState icon="📊" title="لا توجد بيانات" className="py-8" /> : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">التاريخ</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">التسجيلات</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">الإيراد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {revenue.slice(0, 30).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-slate-700">{row.date}</td>
                      <td className="py-2 px-3 text-slate-600">{row.enrollments ?? 0}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">{formatMoney(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </Card>
        <Card title="أداء الكورسات">
          <div className="p-6">
          {!coursePerf.length ? <EmptyState icon="📚" title="لا توجد بيانات" className="py-8" /> : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">الكورس</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">التسجيلات</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">الإيراد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coursePerf.slice(0, 15).map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-medium text-slate-800 truncate max-w-[120px]" title={c.title}>{c.title}</td>
                      <td className="py-2 px-3 text-slate-600">{c.total_enrollments ?? 0}</td>
                      <td className="py-2 px-3 text-slate-800">{formatMoney(c.total_revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </Card>
        <Card title="أداء المعلمين">
          <div className="p-6">
          {!instructorPerf.length ? <EmptyState icon="👨‍🏫" title="لا توجد بيانات" className="py-8" /> : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">المعلم</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">الكورسات</th>
                    <th className="text-right py-2 px-3 font-semibold text-slate-600">الإيراد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {instructorPerf.slice(0, 15).map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-medium text-slate-800 truncate max-w-[120px]">{u.full_name}</td>
                      <td className="py-2 px-3 text-slate-600">{u.total_courses ?? 0}</td>
                      <td className="py-2 px-3 text-slate-800">{formatMoney(u.total_revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </Card>
      </div>
    </div>
  )
}
