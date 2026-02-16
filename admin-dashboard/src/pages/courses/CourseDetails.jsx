import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Video } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { coursesAPI, courseSectionsAPI, videosAPI } from '../../services/api';

const CourseDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Section modal
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionForm, setSectionForm] = useState({ title: '', description: '', order: 1, price: '' });
  const [sectionError, setSectionError] = useState('');

  // Lesson modals
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [lessonForm, setLessonForm] = useState({ title: '', section_id: '', is_free: false, order: 1 });
  const [lessonFile, setLessonFile] = useState(null);
  const [lessonError, setLessonError] = useState('');
  const [lessonLoading, setLessonLoading] = useState(false);

  const [editLessonModalOpen, setEditLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [editLessonForm, setEditLessonForm] = useState({
    title: '',
    order: 1,
    is_free: false,
    approval_status: 'pending',
    active: true,
  });
  const [editLessonError, setEditLessonError] = useState('');
  const [editLessonLoading, setEditLessonLoading] = useState(false);

  const loadCourse = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await coursesAPI.getById(id);
      setCourse(res);
    } catch (e) {
      console.error(e);
      setError('فشل تحميل بيانات الكورس');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourse();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const sections = course?.sections || [];

  const totalLessons =
    sections.reduce((sum, s) => sum + (s.lessons?.length || 0), 0) ?? 0;

  const allLessons = sections.reduce(
    (acc, sec) =>
      acc.concat(
        (sec.lessons || []).map((l) => ({
          ...l,
          sectionTitle: sec.title,
        })),
      ),
    [],
  );

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">جاري تحميل بيانات الكورس...</div>;
  }

  if (error || !course) {
    return <div className="p-6 text-sm text-red-600">{error || 'لم يتم العثور على الكورس'}</div>;
  }

  const handleCourseAction = async (type) => {
    try {
      setActionLoading(true);
      if (type === 'approve') await coursesAPI.approve(id);
      if (type === 'reject') await coursesAPI.reject(id, {});
      if (type === 'suspend') await coursesAPI.suspend(id);
      if (type === 'activate') await coursesAPI.activate(id);
      if (type === 'makeFirstFree') await coursesAPI.makeFirstFree(id);
      await loadCourse();
    } catch (e) {
      console.error(e);
      const message = e.response?.data?.message || 'فشلت العملية على الكورس';
      alert(message);
    } finally {
      setActionLoading(false);
    }
  };

  const quickUpdateLesson = async (lessonId, patch) => {
    try {
      await videosAPI.update(lessonId, patch);
      await loadCourse();
    } catch (e) {
      console.error(e);
      alert('فشل تحديث حالة الدرس');
    }
  };

  const openSectionModal = (sec) => {
    if (sec) {
      setEditingSection(sec);
      setSectionForm({
        title: sec.title || '',
        description: sec.description || '',
        order: sec.order ?? 1,
        price: sec.price ?? '',
      });
    } else {
      setEditingSection(null);
      setSectionForm({
        title: '',
        description: '',
        order: (course.sections?.length || 0) + 1,
        price: '',
      });
    }
    setSectionError('');
    setSectionModalOpen(true);
  };

  const submitSection = async (e) => {
    e.preventDefault();
    setSectionError('');
    try {
      const payload = {
        course_id: course.id,
        title: sectionForm.title,
        description: sectionForm.description,
        order: Number(sectionForm.order) || 1,
        price: sectionForm.price ? Number(sectionForm.price) : null,
      };
      if (editingSection) {
        await courseSectionsAPI.update(editingSection.id, payload);
      } else {
        await courseSectionsAPI.create(payload);
      }
      setSectionModalOpen(false);
      await loadCourse();
    } catch (err) {
      console.error(err);
      setSectionError(err.response?.data?.message || 'فشل حفظ الوحدة');
    }
  };

  const deleteSection = async (secId) => {
    if (!window.confirm('حذف هذه الوحدة مع دروسها؟')) return;
    try {
      await courseSectionsAPI.delete(secId);
      await loadCourse();
    } catch (e) {
      console.error(e);
      alert('فشل حذف الوحدة');
    }
  };

  const openLessonModal = () => {
    setLessonForm({
      title: '',
      section_id: course.sections?.[0]?.id || '',
      is_free: false,
      order: totalLessons + 1,
    });
    setLessonFile(null);
    setLessonError('');
    setLessonModalOpen(true);
  };

  const submitLesson = async (e) => {
    e.preventDefault();
    setLessonError('');
    if (!lessonFile) {
      setLessonError('اختر ملف الفيديو');
      return;
    }
    try {
      setLessonLoading(true);
      const fd = new FormData();
      fd.append('course_id', course.id);
      if (lessonForm.section_id) fd.append('section_id', lessonForm.section_id);
      fd.append('title', lessonForm.title);
      fd.append('is_free', lessonForm.is_free ? '1' : '0');
      fd.append('order', lessonForm.order);
      fd.append('video', lessonFile);
      await videosAPI.upload(fd);
      setLessonModalOpen(false);
      await loadCourse();
    } catch (err) {
      console.error(err);
      setLessonError(err.response?.data?.message || 'فشل رفع الفيديو');
    } finally {
      setLessonLoading(false);
    }
  };

  const openEditLessonModal = (lesson) => {
    setEditingLesson(lesson);
    setEditLessonForm({
      title: lesson.title || '',
      order: lesson.order ?? 1,
      is_free: !!lesson.is_free,
      approval_status: lesson.approval_status || 'pending',
      active: lesson.active ?? true,
    });
    setEditLessonError('');
    setEditLessonModalOpen(true);
  };

  const submitEditLesson = async (e) => {
    e.preventDefault();
    setEditLessonError('');
    try {
      setEditLessonLoading(true);
      await videosAPI.update(editingLesson.id, editLessonForm);
      setEditLessonModalOpen(false);
      await loadCourse();
    } catch (err) {
      console.error(err);
      setEditLessonError(err.response?.data?.message || 'فشل حفظ الدرس');
    } finally {
      setEditLessonLoading(false);
    }
  };

  const deleteLesson = async (lessonId) => {
    if (!window.confirm('حذف هذا الدرس (الفيديو)؟')) return;
    try {
      await videosAPI.delete(lessonId);
      await loadCourse();
    } catch (e) {
      console.error(e);
      alert('فشل حذف الدرس');
    }
  };

  return (
    <div className="students-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('courses.courseDetails')}</h1>
          <p className="page-subtitle">{course.title}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Link to="/courses">
            <Button variant="outline">{t('common.back')}</Button>
          </Link>
          <Link to={`/courses/${id}/edit`}>
            <Button variant="outline">تعديل الكورس</Button>
          </Link>
          <Button
            variant="primary"
            disabled={actionLoading}
            onClick={() => handleCourseAction('approve')}
          >
            نشر / موافقة
          </Button>
          <Button
            variant="outline"
            disabled={actionLoading || !course.active}
            onClick={() => handleCourseAction('suspend')}
          >
            تعليق الكورس
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={actionLoading || totalLessons === 0}
            onClick={() => handleCourseAction('makeFirstFree')}
          >
            جعل أول درس مجاني
          </Button>
        </div>
      </div>

      <div className="dashboard-grid">
        <Card title="تفاصيل الكورس">
          <div className="p-4 grid gap-4 text-sm" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div>
              <p className="mb-1"><strong>المادة:</strong></p>
              <p className="text-gray-700">{course.subject?.name || '-'}</p>
            </div>
            <div>
              <p className="mb-1"><strong>الأستاذ:</strong></p>
              <p className="text-gray-700">{course.instructor?.full_name || '-'}</p>
            </div>
            <div>
              <p className="mb-1"><strong>السعر:</strong></p>
              <p className="text-gray-700">{course.price ?? '-'}</p>
            </div>
            <div>
              <p className="mb-1"><strong>حالة الكورس:</strong></p>
              <span
                className={`status-badge ${
                  course.status === 'published' ? 'status-active' : 'status-inactive'
                }`}
              >
                {course.status === 'published'
                  ? 'منشور'
                  : course.status === 'pending'
                  ? 'قيد المراجعة'
                  : 'مسودة'}
              </span>
            </div>
            <div>
              <p className="mb-1"><strong>الحالة التشغيلية:</strong></p>
              <span className={`status-badge ${course.active ? 'status-active' : 'status-inactive'}`}>
                {course.active ? 'نشط' : 'موقوف'}
              </span>
            </div>
            <div>
              <p className="mb-1"><strong>عدد الوحدات:</strong></p>
              <p className="text-gray-700">{course.sections?.length ?? 0}</p>
            </div>
            <div>
              <p className="mb-1"><strong>عدد الدروس:</strong></p>
              <p className="text-gray-700">{totalLessons}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="الوحدات">
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-sm">وحدات الكورس</h3>
            <Button variant="primary" size="sm" onClick={() => openSectionModal(null)}>
              إضافة وحدة
            </Button>
          </div>
          {!course.sections?.length ? (
            <p className="text-sm text-gray-500">لا توجد وحدات.</p>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>العنوان</th>
                    <th>الترتيب</th>
                    <th>السعر</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {course.sections.map((sec) => (
                    <tr key={sec.id}>
                      <td className="font-medium">{sec.title}</td>
                      <td>{sec.order ?? 0}</td>
                      <td>{sec.price ?? '-'}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="action-btn action-btn-edit"
                            onClick={() => openSectionModal(sec)}
                          >
                            تعديل
                          </button>
                          <button
                            className="action-btn action-btn-delete"
                            onClick={() => deleteSection(sec.id)}
                          >
                            حذف
                          </button>
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

      <Card title="الدروس (الفيديوهات)">
        <div className="p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-sm flex items-center gap-1">
              <Video size={16} /> الدروس حسب الوحدات
            </h3>
            <Button variant="primary" size="sm" onClick={openLessonModal}>
              إضافة درس / فيديو
            </Button>
          </div>
          {!allLessons.length ? (
            <p className="text-sm text-gray-500">لا توجد دروس في هذا الكورس.</p>
          ) : (
            <div className="space-y-4">
              {(course.sections || []).map((sec) => (
                <div key={sec.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 flex justify-between items-center">
                    <span className="text-sm font-medium">الوحدة: {sec.title}</span>
                    <span className="text-xs text-gray-500">
                      {(sec.lessons || []).length} درس
                    </span>
                  </div>
                  {!sec.lessons?.length ? (
                    <p className="p-3 text-xs text-gray-500">لا توجد دروس في هذه الوحدة.</p>
                  ) : (
                    <div className="table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>العنوان</th>
                            <th>مجاني</th>
                            <th>الترتيب</th>
                            <th>حالة الموافقة</th>
                            <th>نشط</th>
                            <th style={{ minWidth: 220 }}>الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sec.lessons.map((lesson) => {
                            const isApproved = lesson.approval_status === 'approved';
                            return (
                              <tr key={lesson.id}>
                                <td className="font-medium">{lesson.title}</td>
                                <td>{lesson.is_free ? 'نعم' : 'لا'}</td>
                                <td>{lesson.order ?? 0}</td>
                                <td>{lesson.approval_status || 'pending'}</td>
                                <td>{lesson.active ? 'نعم' : 'لا'}</td>
                                <td>
                                  <div className="table-actions">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        navigate(`/courses/${id}/lessons/${lesson.id}`)
                                      }
                                    >
                                      مشاهدة
                                    </Button>
                                    <Button
                                      variant={isApproved ? 'warning' : 'success'}
                                      size="sm"
                                      onClick={() =>
                                        quickUpdateLesson(lesson.id, {
                                          approval_status: isApproved ? 'rejected' : 'approved',
                                          active: !isApproved,
                                        })
                                      }
                                    >
                                      {isApproved ? 'إيقاف النشر' : 'نشر'}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        quickUpdateLesson(lesson.id, {
                                          is_free: !lesson.is_free,
                                        })
                                      }
                                    >
                                      {lesson.is_free ? 'إلغاء المجانية' : 'جعله مجاني'}
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => openEditLessonModal(lesson)}
                                    >
                                      تعديل
                                    </Button>
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={() => deleteLesson(lesson.id)}
                                    >
                                      حذف
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}

              {allLessons.filter((l) => !l.section_id).length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 flex justify-between items-center">
                    <span className="text-sm font-medium">دروس بدون وحدة</span>
                    <span className="text-xs text-gray-500">
                      {allLessons.filter((l) => !l.section_id).length} درس
                    </span>
                  </div>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>العنوان</th>
                          <th>مجاني</th>
                          <th>الترتيب</th>
                          <th>حالة الموافقة</th>
                          <th>نشط</th>
                          <th style={{ minWidth: 220 }}>الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allLessons
                          .filter((l) => !l.section_id)
                          .map((lesson) => {
                            const isApproved = lesson.approval_status === 'approved';
                            return (
                              <tr key={lesson.id}>
                                <td className="font-medium">{lesson.title}</td>
                                <td>{lesson.is_free ? 'نعم' : 'لا'}</td>
                                <td>{lesson.order ?? 0}</td>
                                <td>{lesson.approval_status || 'pending'}</td>
                                <td>{lesson.active ? 'نعم' : 'لا'}</td>
                                <td>
                                  <div className="table-actions">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        navigate(`/courses/${id}/lessons/${lesson.id}`)
                                      }
                                    >
                                      مشاهدة
                                    </Button>
                                    <Button
                                      variant={isApproved ? 'warning' : 'success'}
                                      size="sm"
                                      onClick={() =>
                                        quickUpdateLesson(lesson.id, {
                                          approval_status: isApproved ? 'rejected' : 'approved',
                                          active: !isApproved,
                                        })
                                      }
                                    >
                                      {isApproved ? 'إيقاف النشر' : 'نشر'}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        quickUpdateLesson(lesson.id, {
                                          is_free: !lesson.is_free,
                                        })
                                      }
                                    >
                                      {lesson.is_free ? 'إلغاء المجانية' : 'جعله مجاني'}
                                    </Button>
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => openEditLessonModal(lesson)}
                                    >
                                      تعديل
                                    </Button>
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={() => deleteLesson(lesson.id)}
                                    >
                                      حذف
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Section Modal */}
      {sectionModalOpen && (
        <div className="modal-backdrop" onClick={() => setSectionModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              {editingSection ? 'تعديل وحدة' : 'إضافة وحدة جديدة'}
            </h3>
            <form onSubmit={submitSection} className="modal-body">
              {sectionError && <div className="login-error">{sectionError}</div>}
              <Input
                label="عنوان الوحدة"
                value={sectionForm.title}
                onChange={(e) =>
                  setSectionForm((f) => ({ ...f, title: e.target.value }))
                }
                required
                fullWidth
              />
              <div>
                <label className="input-label">الوصف</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={sectionForm.description}
                  onChange={(e) =>
                    setSectionForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <Input
                label="الترتيب"
                type="number"
                value={sectionForm.order}
                onChange={(e) =>
                  setSectionForm((f) => ({ ...f, order: e.target.value }))
                }
                fullWidth
              />
              <Input
                label="سعر الوحدة (اختياري)"
                type="number"
                value={sectionForm.price}
                onChange={(e) =>
                  setSectionForm((f) => ({ ...f, price: e.target.value }))
                }
                fullWidth
              />
              <div className="modal-actions">
                <Button type="submit" variant="primary">
                  حفظ
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSectionModalOpen(false)}
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Lesson Modal */}
      {lessonModalOpen && (
        <div className="modal-backdrop" onClick={() => setLessonModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">إضافة درس / فيديو</h3>
            <form onSubmit={submitLesson} className="modal-body">
              {lessonError && <div className="login-error">{lessonError}</div>}
              <Input
                label="عنوان الدرس"
                value={lessonForm.title}
                onChange={(e) =>
                  setLessonForm((f) => ({ ...f, title: e.target.value }))
                }
                required
                fullWidth
              />
              <div>
                <label className="input-label">الوحدة (اختياري)</label>
                <select
                  className="input-field"
                  value={lessonForm.section_id}
                  onChange={(e) =>
                    setLessonForm((f) => ({ ...f, section_id: e.target.value }))
                  }
                >
                  <option value="">بدون وحدة</option>
                  {(course.sections || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">ملف الفيديو</label>
                <input
                  type="file"
                  accept="video/*"
                  className="input-field"
                  onChange={(e) => setLessonFile(e.target.files?.[0] || null)}
                />
              </div>
              <Input
                label="الترتيب"
                type="number"
                value={lessonForm.order}
                onChange={(e) =>
                  setLessonForm((f) => ({ ...f, order: e.target.value }))
                }
                fullWidth
              />
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={lessonForm.is_free}
                  onChange={(e) =>
                    setLessonForm((f) => ({ ...f, is_free: e.target.checked }))
                  }
                />
                <span className="text-sm">درس مجاني</span>
              </div>
              <div className="modal-actions">
                <Button type="submit" variant="primary" loading={lessonLoading}>
                  حفظ ورفع
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLessonModalOpen(false)}
                  disabled={lessonLoading}
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lesson Modal */}
      {editLessonModalOpen && (
        <div className="modal-backdrop" onClick={() => setEditLessonModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">تعديل الدرس</h3>
            <form onSubmit={submitEditLesson} className="modal-body">
              {editLessonError && <div className="login-error">{editLessonError}</div>}
              <Input
                label="العنوان"
                value={editLessonForm.title}
                onChange={(e) =>
                  setEditLessonForm((f) => ({ ...f, title: e.target.value }))
                }
                required
                fullWidth
              />
              <Input
                label="الترتيب"
                type="number"
                value={editLessonForm.order}
                onChange={(e) =>
                  setEditLessonForm((f) => ({ ...f, order: e.target.value }))
                }
                fullWidth
              />
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={editLessonForm.is_free}
                  onChange={(e) =>
                    setEditLessonForm((f) => ({ ...f, is_free: e.target.checked }))
                  }
                />
                <span className="text-sm">مجاني</span>
              </div>
              <div>
                <label className="input-label">حالة الموافقة</label>
                <select
                  className="input-field"
                  value={editLessonForm.approval_status}
                  onChange={(e) =>
                    setEditLessonForm((f) => ({
                      ...f,
                      approval_status: e.target.value,
                    }))
                  }
                >
                  <option value="pending">قيد المراجعة</option>
                  <option value="approved">منشور</option>
                  <option value="rejected">مرفوض</option>
                </select>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={editLessonForm.active}
                  onChange={(e) =>
                    setEditLessonForm((f) => ({ ...f, active: e.target.checked }))
                  }
                />
                <span className="text-sm">نشط</span>
              </div>
              <div className="modal-actions">
                <Button type="submit" variant="primary" loading={editLessonLoading}>
                  حفظ
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditLessonModalOpen(false)}
                  disabled={editLessonLoading}
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseDetails;

