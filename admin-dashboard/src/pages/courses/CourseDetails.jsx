import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Video } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { coursesAPI, courseSectionsAPI, videosAPI, notesAPI, examsAPI } from '../../services/api';

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
  const [lessonForm, setLessonForm] = useState({
    title: '',
    description: '',
    section_id: '',
    is_free: false,
    order: 1,
    duration: 0,
    price: '',
    video_provider: 'youtube',
    video_url: '',
    can_download: true,
    can_purchase_alone: false
  });
  const [lessonFile, setLessonFile] = useState(null);
  const [lessonThumbnail, setLessonThumbnail] = useState(null);
  const [lessonError, setLessonError] = useState('');
  const [lessonLoading, setLessonLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [editLessonModalOpen, setEditLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [editLessonForm, setEditLessonForm] = useState({
    title: '',
    description: '',
    order: 1,
    is_free: false,
    approval_status: 'pending',
    active: true,
    duration: 0,
    price: '',
    video_provider: 'youtube',
    video_url: '',
    can_download: true,
    can_purchase_alone: false
  });
  const [editLessonThumbnail, setEditLessonThumbnail] = useState(null);
  const [editLessonError, setEditLessonError] = useState('');
  const [editLessonLoading, setEditLessonLoading] = useState(false);

  // Notes (Attachments) states
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [noteForm, setNoteForm] = useState({ title: '', description: '', price: '0', is_free: true, prevent_download: false, active: true });
  const [noteFile, setNoteFile] = useState(null);
  const [noteError, setNoteError] = useState('');
  const [noteActionLoading, setNoteActionLoading] = useState(false);

  // Exams states
  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [examForm, setExamForm] = useState({ title: '', description: '', duration: 30 });
  const [examQuestions, setExamQuestions] = useState([
    { question: '', type: 'multiple_choice', options: ['', '', '', ''], correct_answer: '', points: 5 }
  ]);
  const [examError, setExamError] = useState('');
  const [examActionLoading, setExamActionLoading] = useState(false);

  const loadCourse = async () => {
    try {
      setLoading(true);
      setError('');
      const [courseData, notesData, examsData] = await Promise.all([
        coursesAPI.getById(id),
        notesAPI.getAll(id),
        examsAPI.getAll(id)
      ]);
      setCourse(courseData);
      setNotes(notesData);
      setExams(examsData);
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
      description: '',
      section_id: course.sections?.[0]?.id || '',
      is_free: false,
      order: totalLessons + 1,
      duration: 0,
      price: '',
      video_provider: 'youtube',
      video_url: '',
      can_download: true,
      can_purchase_alone: false
    });
    setLessonFile(null);
    setLessonThumbnail(null);
    setLessonError('');
    setLessonModalOpen(true);
  };

  const submitLesson = async (e) => {
    e.preventDefault();
    setLessonError('');
    if (!lessonFile && !lessonForm.video_url) {
      setLessonError('اختر ملف الفيديو أو أدخل رابط يوتيوب');
      return;
    }
    try {
      setLessonLoading(true);
      setUploadProgress(0);
      const fd = new FormData();
      fd.append('course_id', course.id);
      if (lessonForm.section_id) fd.append('section_id', lessonForm.section_id);
      fd.append('title', lessonForm.title);
      fd.append('description', lessonForm.description || '');
      fd.append('is_free', lessonForm.is_free ? '1' : '0');
      fd.append('order', lessonForm.order);
      fd.append('duration', lessonForm.duration || 0);
      fd.append('price', lessonForm.price || 0);
      fd.append('video_provider', lessonForm.video_provider);
      fd.append('can_download', lessonForm.can_download ? '1' : '0');
      fd.append('can_purchase_alone', lessonForm.can_purchase_alone ? '1' : '0');

      if (lessonFile) {
        fd.append('video', lessonFile);
      } else if (lessonForm.video_url) {
        fd.append('youtube_url', lessonForm.video_url);
      }

      if (lessonThumbnail) {
        fd.append('thumbnail', lessonThumbnail);
      }

      await videosAPI.upload(fd, (e) => {
        if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      });
      setUploadProgress(0);
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
      description: lesson.description || '',
      order: lesson.order ?? 1,
      is_free: !!lesson.is_free,
      approval_status: lesson.approval_status || 'pending',
      active: lesson.active ?? true,
      duration: lesson.duration || 0,
      price: lesson.price ?? '',
      video_provider: lesson.video_provider || 'youtube',
      video_url: lesson.video_provider === 'youtube' ? (lesson.video_reference || '') : '',
      can_download: !!lesson.can_download,
      can_purchase_alone: !!lesson.can_purchase_alone
    });
    setEditLessonThumbnail(null);
    setEditLessonError('');
    setEditLessonModalOpen(true);
  };

  const submitEditLesson = async (e) => {
    e.preventDefault();
    setEditLessonError('');
    try {
      setEditLessonLoading(true);

      const fd = new FormData();
      fd.append('title', editLessonForm.title);
      fd.append('description', editLessonForm.description || '');
      fd.append('order', editLessonForm.order);
      fd.append('is_free', editLessonForm.is_free ? '1' : '0');
      fd.append('approval_status', editLessonForm.approval_status);
      fd.append('active', editLessonForm.active ? '1' : '0');
      fd.append('duration', editLessonForm.duration || 0);
      fd.append('price', editLessonForm.price || 0);
      fd.append('can_download', editLessonForm.can_download ? '1' : '0');
      fd.append('can_purchase_alone', editLessonForm.can_purchase_alone ? '1' : '0');
      fd.append('video_provider', editLessonForm.video_provider);

      if (editLessonForm.video_url) {
        fd.append('youtube_url', editLessonForm.video_url);
      }

      if (editLessonThumbnail) {
        fd.append('thumbnail', editLessonThumbnail);
      }

      await videosAPI.update(editingLesson.id, fd);
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

  // --- Attachments (Notes) Logic ---
  const submitNote = async (e) => {
    e.preventDefault();
    if (!noteFile && !editingNote) {
      setNoteError('يرجى اختيار ملف');
      return;
    }
    setNoteError('');
    setNoteActionLoading(true);
    try {
      const fd = new FormData();
      fd.append('course_id', id);
      fd.append('title', noteForm.title);
      fd.append('description', noteForm.description || '');
      fd.append('price', noteForm.price || 0);
      fd.append('is_free', noteForm.is_free ? '1' : '0');
      fd.append('prevent_download', noteForm.prevent_download ? '1' : '0');
      if (noteFile) fd.append('file', noteFile);

      if (editingNote) {
        await notesAPI.update(editingNote.id, {
          title: noteForm.title,
          description: noteForm.description,
          price: noteForm.price,
          is_free: noteForm.is_free,
          prevent_download: noteForm.prevent_download,
          active: noteForm.active
        });
      } else {
        await notesAPI.create(fd);
      }
      setNoteModalOpen(false);
      setNoteFile(null);
      await loadCourse();
    } catch (err) {
      console.error(err);
      setNoteError(err.response?.data?.message || 'فشل حفظ الملف');
    } finally {
      setNoteActionLoading(false);
    }
  };

  const openNoteModal = (note = null) => {
    if (note) {
      setEditingNote(note);
      setNoteForm({
        title: note.title,
        description: note.description || '',
        price: note.price || 0,
        is_free: !!note.is_free,
        prevent_download: !!note.prevent_download,
        active: !!note.active
      });
    } else {
      setEditingNote(null);
      setNoteForm({ title: '', description: '', price: '0', is_free: true, prevent_download: false, active: true });
      setNoteFile(null);
    }
    setNoteError('');
    setNoteModalOpen(true);
  };

  const deleteNote = async (noteId) => {
    if (!window.confirm('حذف هذا الملف نهائياً؟')) return;
    try {
      await notesAPI.delete(noteId);
      await loadCourse();
    } catch (e) {
      console.error(e);
      alert('فشل حذف الملف');
    }
  };

  // --- Exams Logic ---
  const addQuestion = () => {
    setExamQuestions([...examQuestions, { question: '', type: 'multiple_choice', options: ['', '', '', ''], correct_answer: '', points: 5 }]);
  };

  const removeQuestion = (idx) => {
    setExamQuestions(examQuestions.filter((_, i) => i !== idx));
  };

  const updateQuestion = (idx, field, value) => {
    const q = [...examQuestions];
    q[idx][field] = value;
    setExamQuestions(q);
  };

  const updateOption = (qIdx, oIdx, value) => {
    const q = [...examQuestions];
    q[qIdx].options[oIdx] = value;
    setExamQuestions(q);
  };

  const openExamModal = (exam = null) => {
    if (exam) {
      setEditingExam(exam);
      setExamForm({
        title: exam.title,
        description: exam.description || '',
        duration: exam.duration || 30
      });
      setExamQuestions(exam.questions?.length ? exam.questions : [{ question: '', type: 'multiple_choice', options: ['', '', '', ''], correct_answer: '', points: 5 }]);
    } else {
      setEditingExam(null);
      setExamForm({ title: '', description: '', duration: 30 });
      setExamQuestions([{ question: '', type: 'multiple_choice', options: ['', '', '', ''], correct_answer: '', points: 5 }]);
    }
    setExamError('');
    setExamModalOpen(true);
  };

  const submitExam = async (e) => {
    e.preventDefault();
    setExamError('');
    setExamActionLoading(true);
    try {
      const data = {
        course_id: id,
        ...examForm,
        questions: examQuestions
      };
      if (editingExam) {
        await examsAPI.update(editingExam.id, data);
      } else {
        await examsAPI.create(data);
      }
      setExamModalOpen(false);
      await loadCourse();
    } catch (err) {
      console.error(err);
      setExamError(err.response?.data?.message || 'فشل حفظ الامتحان');
    } finally {
      setExamActionLoading(false);
    }
  };

  const deleteExam = async (examId) => {
    if (!window.confirm('حذف هذا الامتحان نهائياً؟')) return;
    try {
      await examsAPI.delete(examId);
      await loadCourse();
    } catch (e) {
      console.error(e);
      alert('فشل حذف الامتحان');
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
                className={`status-badge ${course.status === 'published' ? 'status-active' : 'status-inactive'
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Attachments Section */}
        <Card title="الملفات المرفقة (Attachments)">
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-sm">ملفات الكورس</h3>
              <Button variant="primary" size="sm" onClick={() => openNoteModal(null)}>
                إضافة ملف
              </Button>
            </div>
            {!notes.length ? (
              <p className="text-sm text-gray-500">لا توجد ملفات مرفقة.</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>العنوان</th>
                      <th>النوع</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notes.map((note) => (
                      <tr key={note.id}>
                        <td>{note.title}</td>
                        <td>{note.file_type?.toUpperCase()}</td>
                        <td>
                          <div className="table-actions">
                            <a href={note.file_url} target="_blank" rel="noreferrer" className="text-blue-600 text-xs underline">عرض</a>
                            <Button variant="secondary" size="sm" onClick={() => openNoteModal(note)}>تعديل</Button>
                            <Button variant="danger" size="sm" onClick={() => deleteNote(note.id)}>حذف</Button>
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

        {/* Exams Section */}
        <Card title="الامتحانات (Exams)">
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium text-sm">امتحانات الكورس</h3>
              <Button variant="primary" size="sm" onClick={() => openExamModal(null)}>
                إضافة امتحان
              </Button>
            </div>
            {!exams.length ? (
              <p className="text-sm text-gray-500">لا توجد امتحانات.</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>العنوان</th>
                      <th>المدة</th>
                      <th>الأسئلة</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((exam) => (
                      <tr key={exam.id}>
                        <td>{exam.title}</td>
                        <td>{exam.duration} دقيقة</td>
                        <td>{(exam.questions || []).length}</td>
                        <td>
                          <div className="table-actions">
                            <Button variant="secondary" size="sm" onClick={() => openExamModal(exam)}>تعديل</Button>
                            <Button variant="danger" size="sm" onClick={() => deleteExam(exam.id)}>حذف</Button>
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
      </div>

      {/* Section Modal */}
      {
        sectionModalOpen && (
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
        )
      }

      {/* Add Lesson Modal */}
      {
        lessonModalOpen && (
          <div className="modal-backdrop" onClick={() => setLessonModalOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-title">إضافة درس / فيديو</h3>
              <form onSubmit={submitLesson} className="modal-body">
                {lessonError && <div className="login-error">{lessonError}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="عنوان الدرس"
                    value={lessonForm.title}
                    onChange={(e) =>
                      setLessonForm((f) => ({ ...f, title: e.target.value }))
                    }
                    required
                    fullWidth
                  />
                  <Input
                    label="الترتيب"
                    type="number"
                    value={lessonForm.order}
                    onChange={(e) =>
                      setLessonForm((f) => ({ ...f, order: e.target.value }))
                    }
                    fullWidth
                  />
                </div>

                <div>
                  <label className="input-label">الوصف</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={lessonForm.description}
                    onChange={(e) =>
                      setLessonForm((f) => ({ ...f, description: e.target.value }))
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <label className="input-label">موفر الفيديو</label>
                    <select
                      className="input-field"
                      value={lessonForm.video_provider}
                      onChange={(e) =>
                        setLessonForm((f) => ({ ...f, video_provider: e.target.value }))
                      }
                    >
                      <option value="youtube">YouTube</option>
                      <option value="local">Local Storage</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lessonForm.video_provider === 'youtube' && (
                    <div>
                      <label className="input-label">رابط فيديو يوتيوب</label>
                      <Input
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={lessonForm.video_url}
                        onChange={(e) =>
                          setLessonForm((f) => ({ ...f, video_url: e.target.value }))
                        }
                        fullWidth
                      />
                    </div>
                  )}
                  <div>
                    <label className="input-label">
                      {lessonForm.video_provider === 'youtube' ? 'أو رفع ملف فيديو (لليوتيوب)' : 'رفع ملف فيديو (محلي)'}
                    </label>
                    <input
                      type="file"
                      accept="video/*"
                      className="input-field"
                      onChange={(e) => setLessonFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="المدة (بالدقائق)"
                    type="number"
                    value={lessonForm.duration}
                    onChange={(e) =>
                      setLessonForm((f) => ({ ...f, duration: e.target.value }))
                    }
                    fullWidth
                  />
                  <Input
                    label="السعر (اختياري)"
                    type="number"
                    value={lessonForm.price}
                    onChange={(e) =>
                      setLessonForm((f) => ({ ...f, price: e.target.value }))
                    }
                    fullWidth
                  />
                </div>

                <div>
                  <label className="input-label">الصورة المصغرة (Thumbnail)</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="input-field"
                    onChange={(e) => setLessonThumbnail(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={lessonForm.is_free}
                      onChange={(e) =>
                        setLessonForm((f) => ({ ...f, is_free: e.target.checked }))
                      }
                    />
                    <span className="text-sm">مجاني</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={lessonForm.can_download}
                      onChange={(e) =>
                        setLessonForm((f) => ({ ...f, can_download: e.target.checked }))
                      }
                    />
                    <span className="text-sm">قابل للتحميل</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={lessonForm.can_purchase_alone}
                      onChange={(e) =>
                        setLessonForm((f) => ({ ...f, can_purchase_alone: e.target.checked }))
                      }
                    />
                    <span className="text-sm">شراء منفرد</span>
                  </div>
                </div>

                {lessonLoading && uploadProgress > 0 && (
                  <div style={{ margin: '8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>جاري الرفع...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div style={{ background: '#e5e7eb', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                      <div style={{ background: '#3b82f6', width: `${uploadProgress}%`, height: '100%', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )}
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
        )
      }

      {/* Edit Lesson Modal */}
      {
        editLessonModalOpen && (
          <div className="modal-backdrop" onClick={() => setEditLessonModalOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-title">تعديل الدرس</h3>
              <form onSubmit={submitEditLesson} className="modal-body">
                {editLessonError && <div className="login-error">{editLessonError}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                </div>

                <div>
                  <label className="input-label">الوصف</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={editLessonForm.description}
                    onChange={(e) =>
                      setEditLessonForm((f) => ({ ...f, description: e.target.value }))
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="المدة (بالدقائق)"
                    type="number"
                    value={editLessonForm.duration}
                    onChange={(e) =>
                      setEditLessonForm((f) => ({ ...f, duration: e.target.value }))
                    }
                    fullWidth
                  />
                  <div>
                    <label className="input-label">موفر الفيديو</label>
                    <select
                      className="input-field"
                      value={editLessonForm.video_provider}
                      onChange={(e) =>
                        setEditLessonForm((f) => ({ ...f, video_provider: e.target.value }))
                      }
                    >
                      <option value="youtube">YouTube</option>
                      <option value="local">Local Storage</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="السعر (اختياري)"
                    type="number"
                    value={editLessonForm.price}
                    onChange={(e) =>
                      setEditLessonForm((f) => ({ ...f, price: e.target.value }))
                    }
                    fullWidth
                  />
                  {editLessonForm.video_provider === 'youtube' && (
                    <Input
                      label="رابط فيديو (YouTube)"
                      value={editLessonForm.video_url}
                      onChange={(e) =>
                        setEditLessonForm((f) => ({ ...f, video_url: e.target.value }))
                      }
                      fullWidth
                    />
                  )}
                </div>

                <div>
                  <label className="input-label">تحديث الصورة المصغرة (Thumbnail)</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="input-field"
                    onChange={(e) => setEditLessonThumbnail(e.target.files?.[0] || null)}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editLessonForm.is_free}
                      onChange={(e) =>
                        setEditLessonForm((f) => ({ ...f, is_free: e.target.checked }))
                      }
                    />
                    <span className="text-sm">مجاني</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editLessonForm.can_download}
                      onChange={(e) =>
                        setEditLessonForm((f) => ({ ...f, can_download: e.target.checked }))
                      }
                    />
                    <span className="text-sm">قابل للتحميل</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editLessonForm.can_purchase_alone}
                      onChange={(e) =>
                        setEditLessonForm((f) => ({ ...f, can_purchase_alone: e.target.checked }))
                      }
                    />
                    <span className="text-sm">شراء منفرد</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editLessonForm.active}
                      onChange={(e) =>
                        setEditLessonForm((f) => ({ ...f, active: e.target.checked }))
                      }
                    />
                    <span className="text-sm">نشط</span>
                  </div>
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
          </div >
        )
      }

      {/* Note Modal */}
      {
        noteModalOpen && (
          <div className="modal-backdrop" onClick={() => setNoteModalOpen(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-title">{editingNote ? 'تعديل ملف' : 'إضافة ملف مرفق'}</h3>
              <form onSubmit={submitNote} className="modal-body">
                {noteError && <div className="login-error">{noteError}</div>}
                <Input
                  label="عنوان الملف"
                  value={noteForm.title}
                  onChange={(e) => setNoteForm(f => ({ ...f, title: e.target.value }))}
                  required
                  fullWidth
                />
                <div>
                  <label className="input-label">الوصف</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={noteForm.description}
                    onChange={(e) => setNoteForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="السعر"
                    type="number"
                    value={noteForm.price}
                    onChange={(e) => setNoteForm(f => ({ ...f, price: e.target.value }))}
                    fullWidth
                  />
                  {!editingNote && (
                    <div>
                      <label className="input-label">الملف (PDF, Word, PPT)</label>
                      <input
                        type="file"
                        className="input-field"
                        onChange={(e) => setNoteFile(e.target.files?.[0] || null)}
                        required
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={noteForm.is_free}
                      onChange={(e) => setNoteForm(f => ({ ...f, is_free: e.target.checked }))}
                    />
                    <span className="text-sm">مجاني</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={noteForm.prevent_download}
                      onChange={(e) => setNoteForm(f => ({ ...f, prevent_download: e.target.checked }))}
                    />
                    <span className="text-sm">منع التحميل</span>
                  </div>
                </div>
                {editingNote && (
                  <div className="mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={noteForm.active}
                        onChange={(e) => setNoteForm(f => ({ ...f, active: e.target.checked }))}
                      />
                      <span className="text-sm font-medium">نشط (يظهر للطلاب)</span>
                    </label>
                  </div>
                )}
                <div className="modal-actions">
                  <Button type="submit" variant="primary" loading={noteActionLoading}>
                    {editingNote ? 'حفظ' : 'رفع الملف'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setNoteModalOpen(false)}>
                    إلغاء
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )
      }

      {/* Exam Modal */}
      {
        examModalOpen && (
          <div className="modal-backdrop" onClick={() => setExamModalOpen(false)}>
            <div className="modal" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-title">{editingExam ? 'تعديل امتحان' : 'إنشاء امتحان جديد'}</h3>
              <form onSubmit={submitExam} className="modal-body">
                {examError && <div className="login-error">{examError}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="عنوان الامتحان"
                    value={examForm.title}
                    onChange={(e) => setExamForm(f => ({ ...f, title: e.target.value }))}
                    required
                    fullWidth
                  />
                  <Input
                    label="المدة (بالدقائق)"
                    type="number"
                    value={examForm.duration}
                    onChange={(e) => setExamForm(f => ({ ...f, duration: e.target.value }))}
                    required
                    fullWidth
                  />
                </div>
                <div>
                  <label className="input-label">وصف الامتحان (اختياري)</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={examForm.description}
                    onChange={(e) => setExamForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-sm">الأسئلة ({examQuestions.length})</h4>
                    <Button type="button" variant="outline" size="sm" onClick={addQuestion}>+ إضافة سؤال</Button>
                  </div>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto p-2 border border-gray-100 rounded">
                    {examQuestions.map((q, qIdx) => (
                      <div key={qIdx} className="p-3 border rounded bg-gray-50 relative">
                        <button
                          type="button"
                          className="absolute top-2 left-2 text-red-500 hover:text-red-700"
                          onClick={() => removeQuestion(qIdx)}
                        >
                          حذف
                        </button>
                        <div className="grid grid-cols-1 gap-2">
                          <Input
                            label={`سؤال ${qIdx + 1}`}
                            value={q.question}
                            onChange={(e) => updateQuestion(qIdx, 'question', e.target.value)}
                            required
                            fullWidth
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-500">نوع السؤال</label>
                              <select
                                className="input-field text-sm"
                                value={q.type}
                                onChange={(e) => updateQuestion(qIdx, 'type', e.target.value)}
                              >
                                <option value="multiple_choice">اختيار من متعدد</option>
                                <option value="true_false">صح أو خطأ</option>
                              </select>
                            </div>
                            <Input
                              label="النقاط"
                              type="number"
                              size="sm"
                              value={q.points}
                              onChange={(e) => updateQuestion(qIdx, 'points', e.target.value)}
                              required
                            />
                          </div>

                          {q.type === 'multiple_choice' && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              {q.options.map((opt, oIdx) => (
                                <Input
                                  key={oIdx}
                                  label={`خيار ${oIdx + 1}`}
                                  value={opt}
                                  onChange={(e) => updateOption(qIdx, oIdx, e.target.value)}
                                  required
                                  size="sm"
                                />
                              ))}
                            </div>
                          )}

                          <Input
                            label="الإجابة الصحيحة"
                            placeholder={q.type === 'true_false' ? 'true / false' : 'اكتب النص المطابق تماما'}
                            value={q.correct_answer}
                            onChange={(e) => updateQuestion(qIdx, 'correct_answer', e.target.value)}
                            required
                            fullWidth
                            size="sm"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="modal-actions mt-4">
                  <Button type="submit" variant="primary" loading={examActionLoading}>
                    {editingExam ? 'حفظ' : 'إنشاء الامتحان'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setExamModalOpen(false)}>
                    إلغاء
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default CourseDetails;

