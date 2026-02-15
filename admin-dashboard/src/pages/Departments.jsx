import { useEffect, useState } from 'react'
import api from '../api/axios'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

function DetailCard({ title, children, className = '' }) {
  return (
    <div className={`bg-slate-50 rounded-xl border border-slate-200 p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-slate-500 mb-2">{title}</h3>
      <div className="text-slate-800">{children}</div>
    </div>
  )
}

export default function Departments() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ name: '', name_en: '', description: '', order: 0 })
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Drill-down: قسم → سنوات → فصول → مواد
  const [selectedDept, setSelectedDept] = useState(null)
  const [selectedYear, setSelectedYear] = useState(null)
  const [selectedSemester, setSelectedSemester] = useState(null)
  const [selectedSubject, setSelectedSubject] = useState(null)
  const [yearsList, setYearsList] = useState([])
  const [semestersList, setSemestersList] = useState([])
  const [subjectsList, setSubjectsList] = useState([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [childrenLoading, setChildrenLoading] = useState(false)

  const fetchList = () => {
    setLoading(true)
    api.get('/admin/departments', { params: { per_page: 100 } })
      .then((res) => setList(res.data?.data ?? (Array.isArray(res.data) ? res.data : [])))
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchList()
  }, [])

  const openViewDepartment = (d) => {
    setSelectedDept(d)
    setSelectedYear(null)
    setSelectedSemester(null)
    setSelectedSubject(null)
    setYearsList([])
    setSemestersList([])
    setSubjectsList([])
    setDetailLoading(true)
    setChildrenLoading(true)
    api.get(`/admin/departments/${d.id}`)
      .then((res) => setSelectedDept(res.data))
      .catch(() => {})
      .finally(() => setDetailLoading(false))
    api.get('/admin/years', { params: { department_id: d.id, per_page: 100 } })
      .then((res) => setYearsList(res.data?.data ?? res.data ?? []))
      .catch(() => setYearsList([]))
      .finally(() => setChildrenLoading(false))
  }

  const openViewYear = (y) => {
    setSelectedYear(y)
    setSelectedSemester(null)
    setSelectedSubject(null)
    setSemestersList([])
    setSubjectsList([])
    setDetailLoading(true)
    setChildrenLoading(true)
    api.get(`/admin/years/${y.id}`)
      .then((res) => setSelectedYear(res.data))
      .catch(() => {})
      .finally(() => setDetailLoading(false))
    api.get('/admin/semesters', { params: { year_id: y.id, per_page: 100 } })
      .then((res) => setSemestersList(res.data?.data ?? res.data ?? []))
      .catch(() => setSemestersList([]))
      .finally(() => setChildrenLoading(false))
  }

  const openViewSemester = (s) => {
    setSelectedSemester(s)
    setSelectedSubject(null)
    setSubjectsList([])
    setDetailLoading(true)
    setChildrenLoading(true)
    api.get(`/admin/semesters/${s.id}`)
      .then((res) => setSelectedSemester(res.data))
      .catch(() => {})
      .finally(() => setDetailLoading(false))
    api.get('/admin/subjects', { params: { semester_id: s.id, per_page: 100 } })
      .then((res) => setSubjectsList(res.data?.data ?? res.data ?? []))
      .catch(() => setSubjectsList([]))
      .finally(() => setChildrenLoading(false))
  }

  const openViewSubject = (s) => {
    setDetailLoading(true)
    api.get(`/admin/subjects/${s.id}`)
      .then((res) => setSelectedSubject(res.data))
      .catch(() => {})
      .finally(() => setDetailLoading(false))
  }

  const backToDepartments = () => {
    setSelectedDept(null)
    setSelectedYear(null)
    setSelectedSemester(null)
    setSelectedSubject(null)
    setYearsList([])
    setSemestersList([])
    setSubjectsList([])
  }

  const backToYears = () => {
    setSelectedYear(null)
    setSelectedSemester(null)
    setSelectedSubject(null)
    setSemestersList([])
    setSubjectsList([])
  }

  const backToSemesters = () => {
    setSelectedSemester(null)
    setSelectedSubject(null)
    setSubjectsList([])
  }

  const backToSubjects = () => {
    setSelectedSubject(null)
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ name: '', name_en: '', description: '', order: 0 })
    setSubmitError('')
    setModal(true)
  }

  const openEdit = (d) => {
    setEditingId(d.id)
    setForm({ name: d.name || '', name_en: d.name_en || '', description: d.description || '', order: d.order ?? 0 })
    setSubmitError('')
    setModal(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setSubmitError('')
    setSubmitting(true)
    const payload = { ...form, order: Number(form.order) || 0 }
    const req = editingId
      ? api.put(`/admin/departments/${editingId}`, payload)
      : api.post('/admin/departments', payload)
    req
      .then(() => {
        setModal(false)
        fetchList()
      })
      .catch((err) => setSubmitError(err.response?.data?.message || 'فشل الحفظ'))
      .finally(() => setSubmitting(false))
  }

  const handleDelete = (id) => {
    if (!confirm('حذف هذا القسم؟')) return
    api.delete(`/admin/departments/${id}`).then(() => fetchList()).catch(() => {})
  }

  const inDetailView = selectedDept != null

  return (
    <div className="space-y-6">
      <PageHeader
        title="الأقسام"
        subtitle={inDetailView ? 'عرض تفاصيل القسم والسنوات والفصول والمواد' : 'إدارة الأقسام والمواد'}
        action={
          inDetailView ? (
            <Button variant="secondary" onClick={backToDepartments}>
              ← رجوع لجميع الأقسام
            </Button>
          ) : (
            <Button onClick={openCreate}>إضافة قسم</Button>
          )
        }
      />

      {!inDetailView && (
        <Card>
          {loading ? (
            <Loading />
          ) : !list.length ? (
            <EmptyState title="لا توجد أقسام" description="أضف قسماً من الزر أعلاه." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الاسم</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الاسم (EN)</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الترتيب</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الحالة</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-medium text-slate-800">{d.name}</td>
                      <td className="py-4 px-6 text-slate-600">{d.name_en || '—'}</td>
                      <td className="py-4 px-6 text-slate-600">{d.order ?? 0}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${d.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {d.active ? 'نشط' : 'غير نشط'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2 justify-end">
                          <Button variant="primary" className="!py-1.5 !text-xs" onClick={() => openViewDepartment(d)}>
                            عرض التفاصيل
                          </Button>
                          <Button variant="ghost" className="!py-1.5 !text-xs" onClick={() => openEdit(d)}>تعديل</Button>
                          <Button variant="danger" className="!py-1.5 !text-xs" onClick={() => handleDelete(d.id)}>حذف</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {inDetailView && (
        <div className="space-y-6">
          {/* Breadcrumb */}
          <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <button type="button" onClick={backToDepartments} className="hover:text-primary-600 font-medium">
              الأقسام
            </button>
            {selectedDept && (
              <>
                <span>/</span>
                <span className="font-medium text-slate-800">{selectedDept.name}</span>
              </>
            )}
            {selectedYear && (
              <>
                <span>/</span>
                <button type="button" onClick={backToYears} className="hover:text-primary-600">السنوات</button>
                <span>/</span>
                <span className="font-medium text-slate-800">{selectedYear.name}</span>
              </>
            )}
            {selectedSemester && (
              <>
                <span>/</span>
                <button type="button" onClick={backToSemesters} className="hover:text-primary-600">الفصول</button>
                <span>/</span>
                <span className="font-medium text-slate-800">{selectedSemester.name}</span>
              </>
            )}
            {selectedSubject && (
              <>
                <span>/</span>
                <button type="button" onClick={backToSubjects} className="hover:text-primary-600">المواد</button>
                <span>/</span>
                <span className="font-medium text-slate-800">{selectedSubject.name}</span>
              </>
            )}
          </nav>

          {/* Level 1: تفاصيل القسم + السنوات */}
          {selectedDept && !selectedYear && !selectedSemester && !selectedSubject && (
            <>
              <DetailCard title="تفاصيل القسم">
                {detailLoading ? (
                  <Loading />
                ) : (
                  <div className="space-y-1">
                    <p><span className="text-slate-500">الاسم:</span> {selectedDept.name}</p>
                    {selectedDept.name_en && <p><span className="text-slate-500">الاسم (EN):</span> {selectedDept.name_en}</p>}
                    {selectedDept.description && <p><span className="text-slate-500">الوصف:</span> {selectedDept.description}</p>}
                    <p><span className="text-slate-500">الترتيب:</span> {selectedDept.order ?? 0}</p>
                  </div>
                )}
              </DetailCard>
              <Card title="السنوات">
                {childrenLoading ? <Loading /> : !yearsList.length ? <EmptyState title="لا توجد سنوات في هذا القسم" /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80">
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">الاسم</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">الترتيب</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {yearsList.map((y) => (
                          <tr key={y.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-medium text-slate-800">{y.name}</td>
                            <td className="py-3 px-4 text-slate-600">{y.order ?? 0}</td>
                            <td className="py-3 px-4">
                              <Button variant="primary" className="!py-1.5 !text-xs" onClick={() => openViewYear(y)}>عرض التفاصيل</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}

          {/* Level 2: تفاصيل السنة + الفصول */}
          {selectedDept && selectedYear && !selectedSemester && !selectedSubject && (
            <>
              <div className="flex gap-2">
                <Button variant="secondary" className="!py-1.5 !text-xs" onClick={backToYears}>← رجوع للسنوات</Button>
              </div>
              <DetailCard title="تفاصيل السنة">
                {detailLoading ? (
                  <Loading />
                ) : (
                  <div className="space-y-1">
                    <p><span className="text-slate-500">الاسم:</span> {selectedYear.name}</p>
                    <p><span className="text-slate-500">الترتيب:</span> {selectedYear.order ?? 0}</p>
                  </div>
                )}
              </DetailCard>
              <Card title="الفصول">
                {childrenLoading ? <Loading /> : !semestersList.length ? <EmptyState title="لا توجد فصول في هذه السنة" /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80">
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">الاسم</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">الترتيب</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {semestersList.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-medium text-slate-800">{s.name}</td>
                            <td className="py-3 px-4 text-slate-600">{s.order ?? 0}</td>
                            <td className="py-3 px-4">
                              <Button variant="primary" className="!py-1.5 !text-xs" onClick={() => openViewSemester(s)}>عرض التفاصيل</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}

          {/* Level 3: تفاصيل الفصل + المواد */}
          {selectedDept && selectedYear && selectedSemester && !selectedSubject && (
            <>
              <div className="flex gap-2">
                <Button variant="secondary" className="!py-1.5 !text-xs" onClick={backToSemesters}>← رجوع للفصول</Button>
              </div>
              <DetailCard title="تفاصيل الفصل">
                {detailLoading ? (
                  <Loading />
                ) : (
                  <div className="space-y-1">
                    <p><span className="text-slate-500">الاسم:</span> {selectedSemester.name}</p>
                    <p><span className="text-slate-500">الترتيب:</span> {selectedSemester.order ?? 0}</p>
                  </div>
                )}
              </DetailCard>
              <Card title="المواد">
                {childrenLoading ? <Loading /> : !subjectsList.length ? <EmptyState title="لا توجد مواد في هذا الفصل" /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80">
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">الاسم</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">الوصف</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {subjectsList.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-medium text-slate-800">{s.name}</td>
                            <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{s.description || '—'}</td>
                            <td className="py-3 px-4">
                              <Button variant="primary" className="!py-1.5 !text-xs" onClick={() => openViewSubject(s)}>عرض التفاصيل</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}

          {/* Level 4: تفاصيل المادة فقط */}
          {selectedSubject && (
            <>
              <div className="flex gap-2">
                <Button variant="secondary" className="!py-1.5 !text-xs" onClick={backToSubjects}>← رجوع للمواد</Button>
              </div>
              <DetailCard title="تفاصيل المادة">
              {detailLoading ? (
                <Loading />
              ) : (
                <div className="space-y-1">
                  <p><span className="text-slate-500">الاسم:</span> {selectedSubject.name}</p>
                  {selectedSubject.slug && <p><span className="text-slate-500">المعرّف:</span> {selectedSubject.slug}</p>}
                  {selectedSubject.description && <p><span className="text-slate-500">الوصف:</span> {selectedSubject.description}</p>}
                  {selectedSubject.courses?.length > 0 && (
                    <p><span className="text-slate-500">عدد الكورسات:</span> {selectedSubject.courses.length}</p>
                  )}
                </div>
              )}
              </DetailCard>
            </>
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !submitting && setModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg text-slate-800 mb-4">{editingId ? 'تعديل القسم' : 'إضافة قسم'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && <p className="text-red-600 text-sm">{submitError}</p>}
              <Input label="الاسم (عربي)" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              <Input label="الاسم (إنجليزي)" value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} />
              <Input label="الوصف" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
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
