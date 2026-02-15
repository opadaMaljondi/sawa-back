import { useEffect, useState } from 'react'
import api from '../api/axios'
import PageHeader from '../components/ui/PageHeader'
import Card from '../components/ui/Card'
import Loading from '../components/ui/Loading'
import EmptyState from '../components/ui/EmptyState'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'

const statusLabels = { draft: 'مسودة', pending: 'قيد المراجعة', published: 'منشور' }
const statusClass = { draft: 'bg-slate-100 text-slate-600', pending: 'bg-amber-100 text-amber-700', published: 'bg-emerald-100 text-emerald-700' }
const approvalLabels = { pending: 'قيد المراجعة', approved: 'موافق عليه', rejected: 'مرفوض' }

function DetailCard({ title, children, className = '' }) {
  return (
    <div className={`bg-slate-50 rounded-xl border border-slate-200 p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-slate-500 mb-2">{title}</h3>
      <div className="text-slate-800">{children}</div>
    </div>
  )
}

export default function Courses() {
  const [data, setData] = useState({ data: [], current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [keyword, setKeyword] = useState('')
  const [actioning, setActioning] = useState(null)

  // Detail view (عرض تفاصيل الكورس)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Add course modal
  const [instructors, setInstructors] = useState([])
  const [subjects, setSubjects] = useState([])
  const [showAddCourse, setShowAddCourse] = useState(false)
  const [courseForm, setCourseForm] = useState({
    instructor_id: '', subject_id: '', title: '', description: '', price: '', status: 'published', active: true,
    allow_section_purchase: false, allow_lesson_purchase: false, free_first_lesson: false,
  })
  const [courseFormError, setCourseFormError] = useState('')
  const [courseSubmitting, setCourseSubmitting] = useState(false)

  // Edit course modal (تفاصيل الكورس)
  const [showEditCourse, setShowEditCourse] = useState(false)
  const [editCourseForm, setEditCourseForm] = useState({})
  const [editCourseError, setEditCourseError] = useState('')
  const [editCourseSubmitting, setEditCourseSubmitting] = useState(false)

  // Section modal (إضافة/تعديل وحدة)
  const [showSectionModal, setShowSectionModal] = useState(false)
  const [editingSectionId, setEditingSectionId] = useState(null)
  const [sectionForm, setSectionForm] = useState({ title: '', description: '', order: 1, price: '' })
  const [sectionError, setSectionError] = useState('')
  const [sectionSubmitting, setSectionSubmitting] = useState(false)

  // Add lesson modal (إضافة درس - رفع فيديو)
  const [showLessonModal, setShowLessonModal] = useState(false)
  const [lessonForm, setLessonForm] = useState({ title: '', section_id: '', is_free: false, order: 1 })
  const [lessonVideoFile, setLessonVideoFile] = useState(null)
  const [lessonError, setLessonError] = useState('')
  const [lessonSubmitting, setLessonSubmitting] = useState(false)

  // Edit lesson modal
  const [showEditLessonModal, setShowEditLessonModal] = useState(false)
  const [editingLesson, setEditingLesson] = useState(null)
  const [editLessonForm, setEditLessonForm] = useState({ title: '', order: 1, is_free: false, approval_status: 'pending', active: true })
  const [editLessonError, setEditLessonError] = useState('')
  const [editLessonSubmitting, setEditLessonSubmitting] = useState(false)

  const fetchList = () => {
    setLoading(true)
    const params = { page }
    if (statusFilter) params.status = statusFilter
    if (keyword) params.keyword = keyword
    api.get('/admin/courses', { params })
      .then((res) => setData(res.data))
      .catch(() => setData({ data: [], current_page: 1, last_page: 1 }))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchList() }, [page, statusFilter])
  useEffect(() => {
    api.get('/admin/instructors', { params: { per_page: 200 } }).then((res) => setInstructors(res.data?.data ?? res.data ?? [])).catch(() => {})
    api.get('/admin/subjects', { params: { per_page: 500 } }).then((res) => setSubjects(res.data?.data ?? res.data ?? [])).catch(() => {})
  }, [])

  const openCourseDetail = (c) => {
    setSelectedCourse(null)
    setDetailLoading(true)
    api.get(`/admin/courses/${c.id}`)
      .then((res) => setSelectedCourse(res.data))
      .catch(() => {})
      .finally(() => setDetailLoading(false))
  }

  const refreshCourseDetail = () => {
    if (!selectedCourse?.id) return
    setDetailLoading(true)
    api.get(`/admin/courses/${selectedCourse.id}`)
      .then((res) => setSelectedCourse(res.data))
      .catch(() => {})
      .finally(() => setDetailLoading(false))
  }

  const backToList = () => setSelectedCourse(null)

  const handleAction = (courseId, action) => {
    setActioning(courseId)
    const endpoints = {
      approve: () => api.post(`/admin/courses/${courseId}/approve`),
      reject: () => api.post(`/admin/courses/${courseId}/reject`),
      suspend: () => api.post(`/admin/courses/${courseId}/suspend`),
      activate: () => api.post(`/admin/courses/${courseId}/activate`),
    }
    const fn = endpoints[action]
    if (!fn) return setActioning(null)
    fn().then(() => { fetchList(); if (selectedCourse?.id === courseId) refreshCourseDetail() }).catch(() => {}).finally(() => setActioning(null))
  }

  const handleAddCourse = (e) => {
    e.preventDefault()
    setCourseFormError('')
    setCourseSubmitting(true)
    const payload = {
      instructor_id: Number(courseForm.instructor_id),
      subject_id: Number(courseForm.subject_id),
      title: courseForm.title,
      description: courseForm.description || '',
      price: Number(courseForm.price) || 0,
      status: courseForm.status,
      active: courseForm.active,
      allow_section_purchase: courseForm.allow_section_purchase,
      allow_lesson_purchase: courseForm.allow_lesson_purchase,
      free_first_lesson: courseForm.free_first_lesson,
    }
    api.post('/admin/courses', payload)
      .then(() => { setShowAddCourse(false); setCourseForm({ instructor_id: '', subject_id: '', title: '', description: '', price: '', status: 'published', active: true, allow_section_purchase: false, allow_lesson_purchase: false, free_first_lesson: false }); fetchList() })
      .catch((err) => setCourseFormError(err.response?.data?.message || 'فشل الحفظ'))
      .finally(() => setCourseSubmitting(false))
  }

  const openEditCourse = () => {
    if (!selectedCourse) return
    setEditCourseForm({
      title: selectedCourse.title,
      description: selectedCourse.description || '',
      price: selectedCourse.price ?? '',
      status: selectedCourse.status,
      active: selectedCourse.active ?? true,
      allow_section_purchase: selectedCourse.allow_section_purchase ?? false,
      allow_lesson_purchase: selectedCourse.allow_lesson_purchase ?? false,
      free_first_lesson: selectedCourse.free_first_lesson ?? false,
    })
    setEditCourseError('')
    setShowEditCourse(true)
  }

  const handleEditCourse = (e) => {
    e.preventDefault()
    setEditCourseError('')
    setEditCourseSubmitting(true)
    api.put(`/admin/courses/${selectedCourse.id}`, editCourseForm)
      .then(() => { setShowEditCourse(false); refreshCourseDetail(); fetchList() })
      .catch((err) => setEditCourseError(err.response?.data?.message || 'فشل الحفظ'))
      .finally(() => setEditCourseSubmitting(false))
  }

  const openAddSection = () => {
    setEditingSectionId(null)
    setSectionForm({ title: '', description: '', order: (selectedCourse?.sections?.length ?? 0) + 1, price: '' })
    setSectionError('')
    setShowSectionModal(true)
  }

  const openEditSection = (sec) => {
    setEditingSectionId(sec.id)
    setSectionForm({ title: sec.title || '', description: sec.description || '', order: sec.order ?? 1, price: sec.price ?? '' })
    setSectionError('')
    setShowSectionModal(true)
  }

  const handleSectionSubmit = (e) => {
    e.preventDefault()
    setSectionError('')
    setSectionSubmitting(true)
    const payload = { ...sectionForm, course_id: selectedCourse.id, order: Number(sectionForm.order) || 1, price: sectionForm.price ? Number(sectionForm.price) : null }
    const req = editingSectionId ? api.put(`/admin/course-sections/${editingSectionId}`, payload) : api.post('/admin/course-sections', payload)
    req.then(() => { setShowSectionModal(false); refreshCourseDetail() })
      .catch((err) => setSectionError(err.response?.data?.message || 'فشل الحفظ'))
      .finally(() => setSectionSubmitting(false))
  }

  const deleteSection = (id) => {
    if (!confirm('حذف هذه الوحدة؟')) return
    api.delete(`/admin/course-sections/${id}`).then(() => refreshCourseDetail()).catch(() => {})
  }

  const openAddLesson = () => {
    setLessonForm({ title: '', section_id: selectedCourse?.sections?.[0]?.id ?? '', is_free: false, order: (allLessons().length || 0) + 1 })
    setLessonVideoFile(null)
    setLessonError('')
    setShowLessonModal(true)
  }

  const allLessons = () => {
    if (!selectedCourse?.sections) return []
    return selectedCourse.sections.reduce((acc, sec) => acc.concat((sec.lessons || []).map((l) => ({ ...l, sectionTitle: sec.title }))), [])
  }

  const handleAddLesson = (e) => {
    e.preventDefault()
    setLessonError('')
    if (!lessonVideoFile) { setLessonError('اختر ملف فيديو'); return }
    setLessonSubmitting(true)
    const fd = new FormData()
    fd.append('course_id', selectedCourse.id)
    fd.append('title', lessonForm.title)
    fd.append('is_free', lessonForm.is_free ? '1' : '0')
    fd.append('order', lessonForm.order)
    if (lessonForm.section_id) fd.append('section_id', lessonForm.section_id)
    fd.append('video', lessonVideoFile)
    api.post('/admin/videos', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(() => { setShowLessonModal(false); refreshCourseDetail() })
      .catch((err) => setLessonError(err.response?.data?.message || 'فشل رفع الفيديو'))
      .finally(() => setLessonSubmitting(false))
  }

  const openEditLesson = (lesson) => {
    setEditingLesson(lesson)
    setEditLessonForm({ title: lesson.title || '', order: lesson.order ?? 1, is_free: lesson.is_free ?? false, approval_status: lesson.approval_status || 'pending', active: lesson.active ?? true })
    setEditLessonError('')
    setShowEditLessonModal(true)
  }

  const handleEditLesson = (e) => {
    e.preventDefault()
    setEditLessonError('')
    setEditLessonSubmitting(true)
    api.put(`/admin/videos/${editingLesson.id}`, editLessonForm)
      .then(() => { setShowEditLessonModal(false); refreshCourseDetail() })
      .catch((err) => setEditLessonError(err.response?.data?.message || 'فشل الحفظ'))
      .finally(() => setEditLessonSubmitting(false))
  }

  const deleteLesson = (id) => {
    if (!confirm('حذف هذا الدرس؟')) return
    api.delete(`/admin/videos/${id}`).then(() => refreshCourseDetail()).catch(() => {})
  }

  const formatMoney = (n) => (n != null ? new Intl.NumberFormat('ar-IQ').format(n) : '—')

  if (selectedCourse != null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={selectedCourse.title || 'تفاصيل الكورس'}
          subtitle="تفاصيل الكورس ووحداته ودروسه"
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={backToList}>← رجوع للكورسات</Button>
              <Button variant="ghost" onClick={openEditCourse}>تعديل التفاصيل</Button>
            </div>
          }
        />
        {detailLoading ? (
          <Loading />
        ) : (
          <>
            <DetailCard title="تفاصيل الكورس">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <p><span className="text-slate-500">المعلم:</span> {selectedCourse.instructor?.full_name}</p>
                <p><span className="text-slate-500">المادة:</span> {selectedCourse.subject?.name}</p>
                <p><span className="text-slate-500">السعر:</span> {formatMoney(selectedCourse.price)}</p>
                <p><span className="text-slate-500">الحالة:</span> <span className={statusClass[selectedCourse.status]}>{statusLabels[selectedCourse.status]}</span></p>
                <p><span className="text-slate-500">نشط:</span> {selectedCourse.active ? 'نعم' : 'لا'}</p>
                {selectedCourse.description && <p className="sm:col-span-2"><span className="text-slate-500">الوصف:</span> {selectedCourse.description}</p>}
              </div>
              <div className="flex gap-2 mt-3">
                {selectedCourse.status === 'pending' && (
                  <>
                    <Button variant="primary" className="!py-1.5 !text-xs" disabled={actioning === selectedCourse.id} onClick={() => handleAction(selectedCourse.id, 'approve')}>موافقة</Button>
                    <Button variant="danger" className="!py-1.5 !text-xs" disabled={actioning === selectedCourse.id} onClick={() => handleAction(selectedCourse.id, 'reject')}>رفض</Button>
                  </>
                )}
                {selectedCourse.status === 'published' && selectedCourse.active && (
                  <Button variant="ghost" className="!py-1.5 !text-xs" disabled={actioning === selectedCourse.id} onClick={() => handleAction(selectedCourse.id, 'suspend')}>إيقاف</Button>
                )}
                {selectedCourse.status === 'published' && !selectedCourse.active && (
                  <Button variant="primary" className="!py-1.5 !text-xs" disabled={actioning === selectedCourse.id} onClick={() => handleAction(selectedCourse.id, 'activate')}>تفعيل</Button>
                )}
              </div>
            </DetailCard>

            <Card title="وحدات الكورس (أقسام الكورس)" className="overflow-visible">
              <div className="p-6">
                <div className="flex justify-end mb-4">
                  <Button variant="primary" className="!py-1.5 !text-xs" onClick={openAddSection}>إضافة وحدة</Button>
                </div>
                {!selectedCourse.sections?.length ? (
                  <EmptyState title="لا توجد وحدات" description="أضف وحدة من الزر أعلاه." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80">
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">العنوان</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">الترتيب</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">السعر</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedCourse.sections.map((sec) => (
                          <tr key={sec.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-medium text-slate-800">{sec.title}</td>
                            <td className="py-3 px-4 text-slate-600">{sec.order ?? 0}</td>
                            <td className="py-3 px-4 text-slate-600">{formatMoney(sec.price)}</td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2 justify-end">
                                <Button variant="ghost" className="!py-1.5 !text-xs" onClick={() => openEditSection(sec)}>تعديل</Button>
                                <Button variant="danger" className="!py-1.5 !text-xs" onClick={() => deleteSection(sec.id)}>حذف</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>

            <Card title="الدروس" className="overflow-visible">
              <div className="p-6">
                <div className="flex justify-end mb-4">
                  <Button variant="primary" className="!py-1.5 !text-xs" onClick={openAddLesson}>إضافة درس</Button>
                </div>
                {!allLessons().length ? (
                  <EmptyState title="لا توجد دروس" description="أضف درساً (رفع فيديو) من الزر أعلاه." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80">
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">العنوان</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">الوحدة</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">مجاني</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">الترتيب</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">الموافقة</th>
                          <th className="text-right py-3 px-4 text-sm font-semibold text-slate-600">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allLessons().map((lesson) => (
                          <tr key={lesson.id} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-medium text-slate-800">{lesson.title}</td>
                            <td className="py-3 px-4 text-slate-600">{lesson.sectionTitle ?? '—'}</td>
                            <td className="py-3 px-4 text-slate-600">{lesson.is_free ? 'نعم' : 'لا'}</td>
                            <td className="py-3 px-4 text-slate-600">{lesson.order ?? 0}</td>
                            <td className="py-3 px-4">
                              <span className={`text-xs px-2 py-0.5 rounded ${lesson.approval_status === 'approved' ? 'bg-emerald-100 text-emerald-700' : lesson.approval_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                                {approvalLabels[lesson.approval_status] || lesson.approval_status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2 justify-end">
                                <Button variant="ghost" className="!py-1.5 !text-xs" onClick={() => openEditLesson(lesson)}>تعديل</Button>
                                <Button variant="danger" className="!py-1.5 !text-xs" onClick={() => deleteLesson(lesson.id)}>حذف</Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </>
        )}

        {/* Edit course modal */}
        {showEditCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !editCourseSubmitting && setShowEditCourse(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-display font-bold text-lg text-slate-800 mb-4">تعديل تفاصيل الكورس</h3>
              <form onSubmit={handleEditCourse} className="space-y-4">
                {editCourseError && <p className="text-red-600 text-sm">{editCourseError}</p>}
                <Input label="العنوان" value={editCourseForm.title} onChange={(e) => setEditCourseForm((f) => ({ ...f, title: e.target.value }))} required />
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">الوصف</label><textarea value={editCourseForm.description} onChange={(e) => setEditCourseForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" rows={2} /></div>
                <Input label="السعر" type="number" value={editCourseForm.price} onChange={(e) => setEditCourseForm((f) => ({ ...f, price: e.target.value }))} required />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">الحالة</label>
                  <select value={editCourseForm.status} onChange={(e) => setEditCourseForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                    <option value="draft">مسودة</option><option value="pending">قيد المراجعة</option><option value="published">منشور</option>
                  </select>
                </div>
                <div className="flex items-center gap-2"><input type="checkbox" checked={editCourseForm.active} onChange={(e) => setEditCourseForm((f) => ({ ...f, active: e.target.checked }))} /><span className="text-sm">نشط</span></div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={editCourseSubmitting}>حفظ</Button>
                  <Button type="button" variant="secondary" onClick={() => setShowEditCourse(false)} disabled={editCourseSubmitting}>إلغاء</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Section modal */}
        {showSectionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !sectionSubmitting && setShowSectionModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-display font-bold text-lg text-slate-800 mb-4">{editingSectionId ? 'تعديل الوحدة' : 'إضافة وحدة'}</h3>
              <form onSubmit={handleSectionSubmit} className="space-y-4">
                {sectionError && <p className="text-red-600 text-sm">{sectionError}</p>}
                <Input label="عنوان الوحدة" value={sectionForm.title} onChange={(e) => setSectionForm((f) => ({ ...f, title: e.target.value }))} required />
                <div><label className="block text-sm font-medium text-slate-700 mb-1.5">الوصف</label><textarea value={sectionForm.description} onChange={(e) => setSectionForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" rows={2} /></div>
                <Input label="الترتيب" type="number" value={sectionForm.order} onChange={(e) => setSectionForm((f) => ({ ...f, order: e.target.value }))} />
                <Input label="سعر الوحدة (اختياري)" type="number" value={sectionForm.price} onChange={(e) => setSectionForm((f) => ({ ...f, price: e.target.value }))} />
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={sectionSubmitting}>حفظ</Button>
                  <Button type="button" variant="secondary" onClick={() => setShowSectionModal(false)} disabled={sectionSubmitting}>إلغاء</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add lesson modal */}
        {showLessonModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !lessonSubmitting && setShowLessonModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-display font-bold text-lg text-slate-800 mb-4">إضافة درس (رفع فيديو)</h3>
              <form onSubmit={handleAddLesson} className="space-y-4">
                {lessonError && <p className="text-red-600 text-sm">{lessonError}</p>}
                <Input label="عنوان الدرس" value={lessonForm.title} onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))} required />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">الوحدة (اختياري)</label>
                  <select value={lessonForm.section_id} onChange={(e) => setLessonForm((f) => ({ ...f, section_id: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                    <option value="">— بدون وحدة —</option>
                    {(selectedCourse?.sections || []).map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">ملف الفيديو (mp4, avi, mov)</label>
                  <input type="file" accept="video/mp4,video/avi,video/quicktime,.mp4,.avi,.mov" onChange={(e) => setLessonVideoFile(e.target.files?.[0] || null)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" required />
                </div>
                <Input label="الترتيب" type="number" value={lessonForm.order} onChange={(e) => setLessonForm((f) => ({ ...f, order: e.target.value }))} />
                <div className="flex items-center gap-2"><input type="checkbox" checked={lessonForm.is_free} onChange={(e) => setLessonForm((f) => ({ ...f, is_free: e.target.checked }))} /><span className="text-sm">درس مجاني</span></div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={lessonSubmitting}>{lessonSubmitting ? 'جاري الرفع...' : 'رفع'}</Button>
                  <Button type="button" variant="secondary" onClick={() => setShowLessonModal(false)} disabled={lessonSubmitting}>إلغاء</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit lesson modal */}
        {showEditLessonModal && editingLesson && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !editLessonSubmitting && setShowEditLessonModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-display font-bold text-lg text-slate-800 mb-4">تعديل الدرس</h3>
              <form onSubmit={handleEditLesson} className="space-y-4">
                {editLessonError && <p className="text-red-600 text-sm">{editLessonError}</p>}
                <Input label="العنوان" value={editLessonForm.title} onChange={(e) => setEditLessonForm((f) => ({ ...f, title: e.target.value }))} required />
                <Input label="الترتيب" type="number" value={editLessonForm.order} onChange={(e) => setEditLessonForm((f) => ({ ...f, order: e.target.value }))} />
                <div className="flex items-center gap-2"><input type="checkbox" checked={editLessonForm.is_free} onChange={(e) => setEditLessonForm((f) => ({ ...f, is_free: e.target.checked }))} /><span className="text-sm">مجاني</span></div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">حالة الموافقة</label>
                  <select value={editLessonForm.approval_status} onChange={(e) => setEditLessonForm((f) => ({ ...f, approval_status: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                    <option value="pending">قيد المراجعة</option><option value="approved">موافق عليه</option><option value="rejected">مرفوض</option>
                  </select>
                </div>
                <div className="flex items-center gap-2"><input type="checkbox" checked={editLessonForm.active} onChange={(e) => setEditLessonForm((f) => ({ ...f, active: e.target.checked }))} /><span className="text-sm">نشط</span></div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={editLessonSubmitting}>حفظ</Button>
                  <Button type="button" variant="secondary" onClick={() => setShowEditLessonModal(false)} disabled={editLessonSubmitting}>إلغاء</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الكورسات"
        subtitle="عرض وإدارة الكورسات والموافقة عليها"
        action={<Button onClick={() => setShowAddCourse(true)}>إضافة كورس</Button>}
      />
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="بحث بالعنوان..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchList()}
          className="px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none w-56"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary-500/20 outline-none">
          <option value="">كل الحالات</option>
          <option value="draft">مسودة</option>
          <option value="pending">قيد المراجعة</option>
          <option value="published">منشور</option>
        </select>
        <Button variant="secondary" onClick={fetchList}>بحث</Button>
      </div>
      <Card>
        {loading ? (
          <Loading />
        ) : !data.data?.length ? (
          <EmptyState title="لا توجد كورسات" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">العنوان</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">المعلم</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">المادة</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">السعر</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">الحالة</th>
                    <th className="text-right py-4 px-6 text-sm font-semibold text-slate-600">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.data.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-medium text-slate-800">{c.title}</td>
                      <td className="py-4 px-6 text-slate-600">{c.instructor?.full_name}</td>
                      <td className="py-4 px-6 text-slate-600">{c.subject?.name}</td>
                      <td className="py-4 px-6 text-slate-600">{formatMoney(c.price)}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${statusClass[c.status] || 'bg-slate-100'}`}>
                          {statusLabels[c.status] || c.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-1 justify-end">
                          <Button variant="primary" className="!py-1.5 !text-xs" onClick={() => openCourseDetail(c)}>عرض التفاصيل</Button>
                          {c.status === 'pending' && (
                            <>
                              <Button variant="primary" className="!py-1.5 !text-xs" disabled={actioning === c.id} onClick={() => handleAction(c.id, 'approve')}>موافقة</Button>
                              <Button variant="danger" className="!py-1.5 !text-xs" disabled={actioning === c.id} onClick={() => handleAction(c.id, 'reject')}>رفض</Button>
                            </>
                          )}
                          {c.status === 'published' && c.active && (
                            <Button variant="ghost" className="!py-1.5 !text-xs" disabled={actioning === c.id} onClick={() => handleAction(c.id, 'suspend')}>إيقاف</Button>
                          )}
                          {c.status === 'published' && !c.active && (
                            <Button variant="primary" className="!py-1.5 !text-xs" disabled={actioning === c.id} onClick={() => handleAction(c.id, 'activate')}>تفعيل</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.last_page > 1 && (
              <div className="flex items-center justify-center gap-2 py-4 border-t border-slate-100">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>السابق</Button>
                <span className="text-sm text-slate-600 px-2">{data.current_page} / {data.last_page}</span>
                <Button variant="secondary" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)}>التالي</Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Add course modal */}
      {showAddCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => !courseSubmitting && setShowAddCourse(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display font-bold text-lg text-slate-800 mb-4">إضافة كورس</h3>
            <form onSubmit={handleAddCourse} className="space-y-4">
              {courseFormError && <p className="text-red-600 text-sm">{courseFormError}</p>}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">المعلم</label>
                <select value={courseForm.instructor_id} onChange={(e) => setCourseForm((f) => ({ ...f, instructor_id: e.target.value }))} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                  <option value="">اختر المعلم</option>
                  {instructors.map((i) => <option key={i.id} value={i.id}>{i.full_name} ({i.email})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">المادة</label>
                <select value={courseForm.subject_id} onChange={(e) => setCourseForm((f) => ({ ...f, subject_id: e.target.value }))} required className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                  <option value="">اختر المادة</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <Input label="عنوان الكورس" value={courseForm.title} onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))} required />
              <div><label className="block text-sm font-medium text-slate-700 mb-1.5">الوصف</label><textarea value={courseForm.description} onChange={(e) => setCourseForm((f) => ({ ...f, description: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200" rows={2} /></div>
              <Input label="السعر" type="number" value={courseForm.price} onChange={(e) => setCourseForm((f) => ({ ...f, price: e.target.value }))} required />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">الحالة</label>
                <select value={courseForm.status} onChange={(e) => setCourseForm((f) => ({ ...f, status: e.target.value }))} className="w-full px-4 py-2.5 rounded-xl border border-slate-200">
                  <option value="draft">مسودة</option><option value="pending">قيد المراجعة</option><option value="published">منشور</option>
                </select>
              </div>
              <div className="flex items-center gap-2"><input type="checkbox" checked={courseForm.active} onChange={(e) => setCourseForm((f) => ({ ...f, active: e.target.checked }))} /><span className="text-sm">نشط</span></div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" disabled={courseSubmitting}>حفظ</Button>
                <Button type="button" variant="secondary" onClick={() => setShowAddCourse(false)} disabled={courseSubmitting}>إلغاء</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
