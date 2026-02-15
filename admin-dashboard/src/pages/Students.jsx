import { useEffect, useState } from 'react'
import api from '../api/axios'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

export default function Students() {
  const [data, setData] = useState({ data: [], current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    api.get('/admin/students', { params: { page } })
      .then((res) => setData(res.data))
      .catch(() => setData({ data: [], current_page: 1, last_page: 1 }))
      .finally(() => setLoading(false))
  }, [page])

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('ar-IQ') : '—'

  return (
    <div className="space-y-6">
      <PageHeader
        title="الطلاب"
        subtitle="عرض وإدارة حسابات الطلاب"
      />
      <Card>
        {loading ? (
          <Loading />
        ) : !data.data?.length ? (
          <EmptyState title="لا يوجد طلاب" description="لم يتم تسجيل طلاب بعد." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الاسم</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">البريد</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الهاتف</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الحالة</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">التسجيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-medium text-slate-800">{s.full_name}</p>
                      </td>
                      <td className="py-4 px-6 text-slate-600">{s.email}</td>
                      <td className="py-4 px-6 text-slate-600">{s.phone || '—'}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${s.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {s.active ? 'نشط' : 'موقوف'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-slate-500 text-sm">{formatDate(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.last_page > 1 && (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-slate-100">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  السابق
                </Button>
                <span className="text-sm text-slate-600 px-2">
                  {data.current_page} / {data.last_page}
                </span>
                <Button variant="secondary" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)}>
                  التالي
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
