import { useEffect, useState } from 'react'
import api from '../api/axios'

const statCards = [
  { key: 'total_students', label: 'إجمالي الطلاب', icon: '👥', color: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700' },
  { key: 'total_instructors', label: 'المعلمون', icon: '👨‍🏫', color: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-700' },
  { key: 'total_courses', label: 'الكورسات', icon: '📚', color: 'bg-violet-500', light: 'bg-violet-50', text: 'text-violet-700' },
  { key: 'active_courses', label: 'كورسات نشطة', icon: '✅', color: 'bg-teal-500', light: 'bg-teal-50', text: 'text-teal-700' },
  { key: 'pending_courses', label: 'قيد المراجعة', icon: '⏳', color: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700' },
  { key: 'total_enrollments', label: 'التسجيلات', icon: '📋', color: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-700' },
  { key: 'total_revenue', label: 'إجمالي الإيرادات', icon: '💰', color: 'bg-green-500', light: 'bg-green-50', text: 'text-green-700' },
  { key: 'net_profit', label: 'صافي الأرباح', icon: '📈', color: 'bg-rose-500', light: 'bg-rose-50', text: 'text-rose-700' },
]

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [topCourses, setTopCourses] = useState([])
  const [recentEnrollments, setRecentEnrollments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const [statsRes, topRes, enrollRes] = await Promise.all([
          api.get('/admin/dashboard/stats'),
          api.get('/admin/dashboard/top-courses'),
          api.get('/admin/dashboard/recent-enrollments'),
        ])
        setStats(statsRes.data.stats)
        setTopCourses(topRes.data)
        setRecentEnrollments(enrollRes.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  const formatMoney = (n) => {
    if (n == null) return '0'
    return new Intl.NumberFormat('ar-IQ', { style: 'decimal', maximumFractionDigits: 0 }).format(n)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display font-bold text-2xl text-slate-800">لوحة التحكم</h1>
        <p className="text-slate-500 mt-1">نظرة عامة على المنصة</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ key, label, icon, light, text }) => (
          <div
            key={key}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all duration-200"
          >
            <div className={`w-12 h-12 rounded-xl ${light} flex items-center justify-center text-2xl mb-4`}>
              {icon}
            </div>
            <p className="text-slate-500 text-sm font-medium">{label}</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${key.includes('revenue') || key.includes('profit') ? text : 'text-slate-800'}`}>
              {key.includes('revenue') || key.includes('profit') ? formatMoney(stats?.[key]) : (stats?.[key] ?? '—')}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Courses */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-display font-semibold text-lg text-slate-800">أفضل الكورسات</h2>
            <p className="text-xs text-slate-500 mt-0.5">حسب عدد الطلاب</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {topCourses.length === 0 ? (
              <p className="p-6 text-slate-500 text-sm">لا توجد بيانات</p>
            ) : (
              topCourses.map((course) => (
                <div key={course.id} className="px-6 py-4 flex items-center justify-between hover:bg-primary-50/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 truncate">{course.title}</p>
                    <p className="text-sm text-slate-500">{course.instructor?.full_name}</p>
                  </div>
                  <span className="shrink-0 mr-3 inline-flex items-center justify-center min-w-[2.5rem] h-8 px-2 rounded-lg bg-primary-100 text-primary-700 font-semibold text-sm">
                    {course.students_count ?? 0}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Enrollments */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-display font-semibold text-lg text-slate-800">آخر التسجيلات</h2>
            <p className="text-xs text-slate-500 mt-0.5">أحدث 20 تسجيل</p>
          </div>
          <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
            {recentEnrollments.length === 0 ? (
              <p className="p-6 text-slate-500 text-sm">لا توجد بيانات</p>
            ) : (
              recentEnrollments.map((e) => (
                <div key={e.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800 truncate">{e.student?.full_name}</p>
                    <p className="text-sm text-slate-500 truncate">{e.course?.title}</p>
                  </div>
                  <span className="shrink-0 text-sm text-slate-500">
                    {e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString('ar-IQ') : '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
