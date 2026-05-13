import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Video } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import { coursesAPI, courseSectionsAPI, videosAPI, notesAPI, examsAPI } from '../../services/api';
import { resolveMediaUrl } from '../../utils/mediaUrl';

/** Chunk size (bytes); align with server VIDEO_CHUNK_MAX_KB / PHP post limits. */
const VIDEO_CHUNK_BYTES = 15 * 1024 * 1024;
/** Use multipart chunks for local/aws files at or above this size. */
const VIDEO_CHUNK_THRESHOLD = 15 * 1024 * 1024;
/** Parallel chunk PUTs (same session; distinct chunk_index per request). */
const VIDEO_CHUNK_PARALLEL = 5;

function chunkUploadStorageKey(courseId, file) {
  if (!file || !courseId) return '';
  return `sawa_video_chunk:${courseId}:${file.name}:${file.size}:${file.lastModified}`;
}

function sleepMs(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function uploadChunkWithRetry(videosApi, formData, onUploadProgress, signal, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      await videosApi.uploadChunk(formData, onUploadProgress, signal);
      return;
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await sleepMs(1000 * (attempt + 1));
    }
  }
}

async function runChunkUploadPool(
  videosApi,
  tasks,
  concurrency,
  signal,
  onTaskDone,
  waitWhilePaused,
  isAbortRequested,
) {
  let cursor = 0;
  async function worker() {
    for (;;) {
      await waitWhilePaused();
      if (signal.aborted || isAbortRequested()) {
        throw new DOMException('Aborted', 'AbortError');
      }
      if (cursor >= tasks.length) return;
      const i = cursor;
      cursor += 1;
      const task = tasks[i];
      await uploadChunkWithRetry(videosApi, task.formData, task.onUploadProgress, signal);
      onTaskDone(task.index);
    }
  }
  const n = Math.min(Math.max(1, concurrency), Math.max(1, tasks.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
}

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
  const [chunkPausedUi, setChunkPausedUi] = useState(false);
  const [chunkPartLabel, setChunkPartLabel] = useState('');
  const chunkPauseRef = useRef(false);
  const chunkAbortRef = useRef(false);
  const chunkFlightAbortRef = useRef(null);
  const chunkUploadIdRef = useRef(null);

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

  // Exams: title + description + file attachment
  const [exams, setExams] = useState([]);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [examForm, setExamForm] = useState({ title: '', description: '' });
  const [examFile, setExamFile] = useState(null);
  const [examError, setExamError] = useState('');
  const [examActionLoading, setExamActionLoading] = useState(false);

  /** Course enrollments with admin / teacher split */
  const [subscriptionsPage, setSubscriptionsPage] = useState(1);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionsData, setSubscriptionsData] = useState([]);
  const [subscriptionsSummary, setSubscriptionsSummary] = useState(null);
  const [subscriptionsMeta, setSubscriptionsMeta] = useState({
    current_page: 1,
    last_page: 1,
    total: 0,
  });

  /** عدد المشتركين المعروض للطلاب (اختياري؛ فارغ = العدد الفعلي) */
  const [displayCountInput, setDisplayCountInput] = useState('');
  const [savingDisplayCount, setSavingDisplayCount] = useState(false);

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

  useEffect(() => {
    if (!course) return;
    setDisplayCountInput(
      course.students_count_display != null ? String(course.students_count_display) : '',
    );
  }, [course]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const loadSubs = async () => {
      setSubscriptionsLoading(true);
      try {
        const res = await coursesAPI.getSubscriptions(id, {
          page: subscriptionsPage,
          per_page: 20,
        });
        if (cancelled) return;
        setSubscriptionsData(res.data || []);
        setSubscriptionsSummary(res.summary ?? null);
        setSubscriptionsMeta({
          current_page: res.current_page ?? 1,
          last_page: res.last_page ?? 1,
          total: res.total ?? 0,
        });
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setSubscriptionsData([]);
          setSubscriptionsSummary(null);
        }
      } finally {
        if (!cancelled) setSubscriptionsLoading(false);
      }
    };
    loadSubs();
    return () => {
      cancelled = true;
    };
  }, [id, subscriptionsPage]);

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

  const savePublicSubscribersCount = async () => {
    const v = displayCountInput.trim();
    let students_count_display = null;
    if (v !== '') {
      const n = parseInt(v, 10);
      if (Number.isNaN(n) || n < 0) {
        alert('أدخل رقماً صحيحاً (0 أو أكثر)');
        return;
      }
      students_count_display = n;
    }
    try {
      setSavingDisplayCount(true);
      await coursesAPI.update(id, { students_count_display });
      await loadCourse();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || 'فشل حفظ العدد المعروض');
    } finally {
      setSavingDisplayCount(false);
    }
  };

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
    chunkPauseRef.current = false;
    chunkAbortRef.current = false;
    chunkFlightAbortRef.current = null;
    chunkUploadIdRef.current = null;
    setChunkPausedUi(false);
    setChunkPartLabel('');
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
      can_purchase_alone: !!course.allow_lesson_purchase
    });
    setLessonFile(null);
    setLessonThumbnail(null);
    setLessonError('');
    setLessonModalOpen(true);
  };

  const submitLesson = async (e) => {
    e.preventDefault();
    setLessonError('');
    const needsUploadOnly = lessonForm.video_provider === 'local' || lessonForm.video_provider === 'aws';
    if (needsUploadOnly && !lessonFile) {
      setLessonError('اختر ملف الفيديو للرفع');
      return;
    }
    if (!needsUploadOnly && !lessonFile && !lessonForm.video_url) {
      setLessonError('اختر ملف الفيديو أو أدخل رابط يوتيوب');
      return;
    }

    const useChunked =
      needsUploadOnly &&
      lessonFile &&
      lessonFile.size > VIDEO_CHUNK_THRESHOLD;

    const waitWhilePaused = async () => {
      while (chunkPauseRef.current && !chunkAbortRef.current) {
        await new Promise((r) => setTimeout(r, 200));
      }
    };

    const isAbortLikeError = (err) =>
      err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || err?.name === 'AbortError';

    try {
      setLessonLoading(true);
      setUploadProgress(0);
      chunkPauseRef.current = false;
      chunkAbortRef.current = false;
      setChunkPausedUi(false);

      if (useChunked) {
        const totalChunks = Math.ceil(lessonFile.size / VIDEO_CHUNK_BYTES) || 1;
        const lsKey = chunkUploadStorageKey(course.id, lessonFile);

        let uploadId = crypto.randomUUID();
        const received = new Set();
        try {
          const raw = localStorage.getItem(lsKey);
          if (raw) {
            const saved = JSON.parse(raw);
            if (saved?.uploadId && Number(saved.totalChunks) === totalChunks) {
              const st = await videosAPI.getChunkUploadStatus({
                upload_id: saved.uploadId,
                total_chunks: totalChunks,
              });
              uploadId = saved.uploadId;
              if (Array.isArray(st.received_chunk_indices) && st.received_chunk_indices.length > 0) {
                st.received_chunk_indices.forEach((idx) => received.add(Number(idx)));
              } else {
                const next = Number(st.next_chunk_index) || 0;
                for (let j = 0; j < next && j < totalChunks; j += 1) {
                  received.add(j);
                }
              }
            }
          }
        } catch {
          /* ignore */
        }

        chunkUploadIdRef.current = uploadId;
        const doneInitial = received.size;
        setUploadProgress(
          totalChunks > 0 ? Math.min(99, Math.round((doneInitial / totalChunks) * 100)) : 0,
        );

        const pendingIndices = [];
        for (let i = 0; i < totalChunks; i += 1) {
          if (!received.has(i)) pendingIndices.push(i);
        }

        const poolAc = new AbortController();
        chunkFlightAbortRef.current = poolAc;

        const tasks = pendingIndices.map((i) => {
          const sliceStart = i * VIDEO_CHUNK_BYTES;
          const blob = lessonFile.slice(sliceStart, sliceStart + VIDEO_CHUNK_BYTES);
          const chunkFd = new FormData();
          chunkFd.append('upload_id', uploadId);
          chunkFd.append('chunk_index', String(i));
          chunkFd.append('total_chunks', String(totalChunks));
          chunkFd.append('original_name', lessonFile.name);
          chunkFd.append('chunk', blob, lessonFile.name);
          return {
            index: i,
            formData: chunkFd,
            onUploadProgress: undefined,
          };
        });

        let done = doneInitial;
        const bumpAfterPart = (chunkIndex) => {
          received.add(chunkIndex);
          done = received.size;
          setUploadProgress(Math.min(99, Math.round((done / totalChunks) * 100)));
          setChunkPartLabel(`جاري الرفع… ${done}/${totalChunks}`);
          try {
            localStorage.setItem(
              lsKey,
              JSON.stringify({
                uploadId,
                totalChunks,
                courseId: course.id,
                lastChunk: chunkIndex,
              }),
            );
          } catch {
            /* ignore quota */
          }
        };

        if (tasks.length > 0) {
          try {
            await runChunkUploadPool(
              videosAPI,
              tasks,
              VIDEO_CHUNK_PARALLEL,
              poolAc.signal,
              bumpAfterPart,
              waitWhilePaused,
              () => chunkAbortRef.current,
            );
          } catch (err) {
            if (isAbortLikeError(err) && chunkAbortRef.current) {
              try {
                await videosAPI.abandonChunkUpload({ upload_id: uploadId });
              } catch {
                /* ignore */
              }
              localStorage.removeItem(lsKey);
              throw new Error('UPLOAD_CANCELLED');
            }
            throw err;
          }
        }

        if (chunkAbortRef.current) {
          try {
            await videosAPI.abandonChunkUpload({ upload_id: uploadId });
          } catch {
            /* ignore */
          }
          localStorage.removeItem(lsKey);
          throw new Error('UPLOAD_CANCELLED');
        }

        setChunkPartLabel('إتمام الدمج والحفظ...');
        const fd = new FormData();
        fd.append('upload_id', uploadId);
        fd.append('total_chunks', String(totalChunks));
        fd.append('original_name', lessonFile.name);
        fd.append('video_provider', lessonForm.video_provider);
        fd.append('course_id', course.id);
        if (lessonForm.section_id) fd.append('section_id', lessonForm.section_id);
        fd.append('title', lessonForm.title);
        fd.append('description', lessonForm.description || '');
        fd.append('is_free', lessonForm.is_free ? '1' : '0');
        fd.append('order', lessonForm.order);
        fd.append('duration', lessonForm.duration || 0);
        fd.append('price', lessonForm.price || 0);
        fd.append('can_download', lessonForm.can_download ? '1' : '0');
        fd.append('can_purchase_alone', lessonForm.can_purchase_alone ? '1' : '0');
        fd.append('async_merge', '1');
        if (lessonThumbnail) fd.append('thumbnail', lessonThumbnail);

        const completeRes = await videosAPI.completeChunkUpload(fd, (ev) => {
          if (ev.total) setUploadProgress(Math.min(100, Math.round((ev.loaded / ev.total) * 100)));
        });

        if (completeRes.status === 202 && completeRes.data?.merge_token) {
          const mergeToken = completeRes.data.merge_token;
          setUploadProgress(95);
          setChunkPartLabel('جاري دمج الأجزاء على الخادم…');
          const deadline = Date.now() + 25 * 60 * 1000;
          let mergeStatus = completeRes.data.status || 'queued';
          while (Date.now() < deadline) {
            await sleepMs(1200);
            const st = await videosAPI.getChunkMergeStatus({ merge_token: mergeToken });
            mergeStatus = st.data?.status || mergeStatus;
            if (mergeStatus === 'completed') {
              setUploadProgress(100);
              break;
            }
            if (mergeStatus === 'failed') {
              throw new Error(st.data?.message || 'فشل دمج الفيديو');
            }
          }
          if (mergeStatus !== 'completed') {
            throw new Error('انتهى وقت انتظار دمج الفيديو. تحقق من تشغيل الطابور (queue worker).');
          }
        }

        localStorage.removeItem(lsKey);
        chunkUploadIdRef.current = null;
      } else {
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

        await videosAPI.upload(fd, (ev) => {
          if (ev.total) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
        });
      }

      setUploadProgress(0);
      setChunkPartLabel('');
      setLessonModalOpen(false);
      await loadCourse();
    } catch (err) {
      console.error(err);
      if (err?.message === 'UPLOAD_CANCELLED') {
        setLessonError('تم إلغاء الرفع.');
      } else {
        setLessonError(err.response?.data?.message || err.message || 'فشل رفع الفيديو');
      }
    } finally {
      setLessonLoading(false);
      chunkPauseRef.current = false;
      chunkAbortRef.current = false;
      chunkFlightAbortRef.current = null;
      setChunkPausedUi(false);
    }
  };

  const handleChunkPause = () => {
    chunkPauseRef.current = true;
    setChunkPausedUi(true);
  };

  const handleChunkResume = () => {
    chunkPauseRef.current = false;
    setChunkPausedUi(false);
  };

  const handleCancelChunkUploadInFlight = () => {
    chunkAbortRef.current = true;
    chunkPauseRef.current = false;
    setChunkPausedUi(false);
    chunkFlightAbortRef.current?.abort();
  };

  const handleDiscardChunkSession = async () => {
    if (!lessonFile || !course) return;
    const lsKey = chunkUploadStorageKey(course.id, lessonFile);
    let id = chunkUploadIdRef.current;
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.uploadId) id = saved.uploadId;
      }
    } catch {
      /* ignore */
    }
    if (id) {
      try {
        await videosAPI.abandonChunkUpload({ upload_id: id });
      } catch {
        /* ignore */
      }
    }
    localStorage.removeItem(lsKey);
    chunkUploadIdRef.current = null;
    setLessonError('');
    setUploadProgress(0);
    setChunkPartLabel('');
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
      video_url:
        lesson.video_provider === 'youtube' ? lesson.video_reference || '' : '',
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

  // --- Exams (file + title + description) ---
  const openExamModal = (exam = null) => {
    if (exam) {
      setEditingExam(exam);
      setExamForm({
        title: exam.title || '',
        description: exam.description || '',
      });
    } else {
      setEditingExam(null);
      setExamForm({ title: '', description: '' });
    }
    setExamFile(null);
    setExamError('');
    setExamModalOpen(true);
  };

  const submitExam = async (e) => {
    e.preventDefault();
    setExamError('');
    if (!editingExam && !examFile) {
      setExamError('يرجى اختيار ملف للامتحان (PDF, Word, PowerPoint, ZIP).');
      return;
    }
    setExamActionLoading(true);
    try {
      if (editingExam) {
        if (examFile) {
          const fd = new FormData();
          fd.append('title', examForm.title);
          fd.append('description', examForm.description || '');
          fd.append('attachment', examFile);
          await examsAPI.update(editingExam.id, fd);
        } else {
          await examsAPI.update(editingExam.id, {
            title: examForm.title,
            description: examForm.description || null,
          });
        }
      } else {
        const fd = new FormData();
        fd.append('course_id', id);
        fd.append('title', examForm.title);
        fd.append('description', examForm.description || '');
        fd.append('attachment', examFile);
        await examsAPI.create(fd);
      }
      setExamModalOpen(false);
      await loadCourse();
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message;
      const errs = err.response?.data?.errors;
      setExamError(
        typeof msg === 'string'
          ? msg
          : errs
            ? Object.values(errs).flat().join(' ')
            : 'فشل حفظ الامتحان',
      );
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
              <p className="mb-1"><strong>{t('courses.expiresAt')}:</strong></p>
              <p className="text-gray-700">
                {course.expires_at ? String(course.expires_at).slice(0, 10) : '—'}
              </p>
            </div>
            <div>
              <p className="mb-1"><strong>عمولة الإدارة (%):</strong></p>
              <p className="text-gray-700">
                {course.admin_commission != null && course.admin_commission !== ''
                  ? `${course.admin_commission}%`
                  : '—'}
              </p>
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
          <div className="px-4 pb-4 border-t border-gray-100 mt-2 pt-4">
            <p className="text-sm font-semibold text-gray-900 mb-1">عدد المشتركين الظاهر للطلاب</p>
            <p className="text-xs text-gray-600 mb-3">
              العدد الفعلي (اشتراكات كورس كامل، يُحدَّث تلقائياً):{' '}
              <strong className="text-gray-900">{course.students_count ?? 0}</strong>
            </p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[200px]">
                <Input
                  label="الرقم المعروض في التطبيق للطلاب (اختياري)"
                  type="number"
                  min="0"
                  step="1"
                  value={displayCountInput}
                  onChange={(e) => setDisplayCountInput(e.target.value)}
                  placeholder="فارغ = استخدام العدد الفعلي أعلاه"
                  fullWidth
                />
              </div>
              <Button
                type="button"
                variant="primary"
                loading={savingDisplayCount}
                onClick={savePublicSubscribersCount}
              >
                حفظ العدد المعروض
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              إذا تركت الحقل فارغاً، يرى الطلاب نفس العدد الفعلي. إذا أدخلت رقماً، يُعرض هذا الرقم بدلاً منه
              (للتسويق أو التقريب) دون تغيير الاشتراكات الحقيقية.
            </p>
          </div>
        </Card>
      </div>

      <Card title="اشتراكات الطلاب (Subscriptions)">
        <div className="p-4">
          <p className="text-xs text-gray-500 mb-3">
            عرض نوع الاشتراك (كورس كامل، وحدة، درس، أو ملف مرفق) مع تقسيم المبلغ بين الإدارة والأستاذ حسب نسبة عمولة الإدارة للكورس.
          </p>
          {subscriptionsLoading ? (
            <p className="text-sm text-gray-500">جاري تحميل الاشتراكات...</p>
          ) : (
            <>
              {subscriptionsSummary && (
                <div
                  className="mb-4 p-3 bg-gray-50 rounded-lg grid gap-3 text-sm"
                  style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
                >
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">عمولة الإدارة (%)</p>
                    <p className="font-semibold text-gray-900">
                      {subscriptionsSummary.admin_commission_percent}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">إجمالي المدفوع (نشط)</p>
                    <p className="font-semibold text-gray-900">
                      {Number(subscriptionsSummary.total_final_price).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">حصة الإدارة</p>
                    <p className="font-semibold text-emerald-800">
                      {Number(subscriptionsSummary.total_admin_amount).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs mb-0.5">حصة الأستاذ</p>
                    <p className="font-semibold text-blue-800">
                      {Number(subscriptionsSummary.total_teacher_amount).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
              {!subscriptionsData.length ? (
                <p className="text-sm text-gray-500">لا توجد اشتراكات مسجّلة لهذا الكورس.</p>
              ) : (
                <>
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>الطالب</th>
                          <th>النوع</th>
                          <th>العنصر</th>
                          <th>المدفوع</th>
                          <th>حصة الإدارة</th>
                          <th>حصة الأستاذ</th>
                          <th>الحالة</th>
                          <th>التاريخ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptionsData.map((row) => (
                          <tr key={row.id}>
                            <td className="text-xs">
                              <div className="font-medium">{row.student?.full_name ?? '—'}</div>
                              <div className="text-gray-500">{row.student?.email ?? ''}</div>
                            </td>
                            <td className="text-xs whitespace-nowrap">{row.type_label}</td>
                            <td className="text-xs max-w-[180px] truncate" title={row.item_title}>
                              {row.item_title}
                            </td>
                            <td className="text-xs font-medium">{Number(row.final_price).toFixed(2)}</td>
                            <td className="text-xs text-emerald-800">
                              {Number(row.admin_amount).toFixed(2)}
                            </td>
                            <td className="text-xs text-blue-800">
                              {Number(row.teacher_amount).toFixed(2)}
                            </td>
                            <td>
                              <span
                                className={`status-badge ${row.active ? 'status-active' : 'status-inactive'}`}
                              >
                                {row.active ? 'نشط' : 'موقوف'}
                              </span>
                            </td>
                            <td className="text-xs text-gray-600 whitespace-nowrap">
                              {row.enrolled_at
                                ? new Date(row.enrolled_at).toLocaleString('ar-EG')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {subscriptionsMeta.last_page > 1 && (
                    <div className="flex justify-between items-center mt-3 text-sm">
                      <span className="text-gray-500">
                        صفحة {subscriptionsMeta.current_page} من {subscriptionsMeta.last_page} (إجمالي{' '}
                        {subscriptionsMeta.total})
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={subscriptionsMeta.current_page <= 1}
                          onClick={() => setSubscriptionsPage((p) => Math.max(1, p - 1))}
                        >
                          السابق
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={subscriptionsMeta.current_page >= subscriptionsMeta.last_page}
                          onClick={() =>
                            setSubscriptionsPage((p) =>
                              Math.min(subscriptionsMeta.last_page, p + 1),
                            )
                          }
                        >
                          التالي
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </Card>

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
                    {notes.map((note) => {
                      const noteFileHref =
                        resolveMediaUrl(note.file_url) || resolveMediaUrl(note.file_path);
                      return (
                      <tr key={note.id}>
                        <td>{note.title}</td>
                        <td>{note.file_type?.toUpperCase()}</td>
                        <td>
                          <div className="table-actions">
                            {noteFileHref ? (
                              <a href={noteFileHref} target="_blank" rel="noreferrer" className="text-blue-600 text-xs underline">عرض</a>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                            <Button variant="secondary" size="sm" onClick={() => openNoteModal(note)}>تعديل</Button>
                            <Button variant="danger" size="sm" onClick={() => deleteNote(note.id)}>حذف</Button>
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
                      <th>الوصف</th>
                      <th>الملف</th>
                      <th>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((exam) => {
                      const fileHref = resolveMediaUrl(exam.attachment_url) || resolveMediaUrl(exam.attachment);
                      return (
                      <tr key={exam.id}>
                        <td className="font-medium">{exam.title}</td>
                        <td className="text-xs text-gray-600 max-w-[200px] truncate">{exam.description || '—'}</td>
                        <td>
                          {fileHref ? (
                            <a href={fileHref} target="_blank" rel="noreferrer" className="text-blue-600 text-xs underline">
                              تحميل
                            </a>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <div className="table-actions">
                            <Button variant="secondary" size="sm" onClick={() => openExamModal(exam)}>تعديل</Button>
                            <Button variant="danger" size="sm" onClick={() => deleteExam(exam.id)}>حذف</Button>
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
        </Card>
      </div>

      <Modal
        isOpen={sectionModalOpen}
        onClose={() => setSectionModalOpen(false)}
        title={editingSection ? 'تعديل وحدة' : 'إضافة وحدة جديدة'}
        size="md"
      >
        <form onSubmit={submitSection} className="space-y-4">
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
          <div className="modal-form-actions">
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
      </Modal>

      <Modal
        isOpen={lessonModalOpen}
        onClose={() => !lessonLoading && setLessonModalOpen(false)}
        title="إضافة درس / فيديو"
        size="xl"
      >
        <form onSubmit={submitLesson} className="space-y-4">
          {lessonError && <div className="login-error">{lessonError}</div>}
          {lessonError &&
            lessonFile &&
            (lessonForm.video_provider === 'local' || lessonForm.video_provider === 'aws') &&
            lessonFile.size > VIDEO_CHUNK_THRESHOLD && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLessonError('');
                    void submitLesson({ preventDefault() {} });
                  }}
                >
                  إعادة المحاولة من آخر جزء
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void handleDiscardChunkSession()}>
                  مسح الجلسة والبدء من جديد
                </Button>
              </div>
            )}
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
                      <option value="aws">AWS S3</option>
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
                      {lessonForm.video_provider === 'youtube'
                        ? 'أو رفع ملف فيديو (لليوتيوب)'
                        : lessonForm.video_provider === 'aws'
                          ? 'رفع ملف فيديو (AWS S3)'
                          : 'رفع ملف فيديو (محلي)'}
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
                <p className="text-xs text-gray-500 mt-1">
                  إعداد الكورس «شراء الدروس منفردة»:{' '}
                  {course.allow_lesson_purchase ? 'مفعّل' : 'غير مفعّل'} — يُعرض هنا كافتراضي عند فتح هذه
                  النافذة؛ غيّر المربع أعلاه إذا أردت استثناء هذا الدرس فقط.
                </p>

          {lessonLoading &&
            lessonFile &&
            (lessonForm.video_provider === 'local' || lessonForm.video_provider === 'aws') && (
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-3">
                {lessonFile.size > VIDEO_CHUNK_THRESHOLD && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={chunkPausedUi}
                      onClick={handleChunkPause}
                    >
                      إيقاف
                    </Button>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={!chunkPausedUi}
                      onClick={handleChunkResume}
                    >
                      استئناف
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={handleCancelChunkUploadInFlight}>
                      إلغاء الرفع
                    </Button>
                    {chunkPausedUi && (
                      <span className="text-sm text-amber-700 dark:text-amber-400 mr-auto">
                        الرفع متوقف مؤقتاً — اضغط استئناف للمتابعة
                      </span>
                    )}
                  </div>
                )}

                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                      marginBottom: 4,
                    }}
                  >
                    <span>{chunkPartLabel || 'جاري الرفع...'}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div
                    style={{
                      background: '#e5e7eb',
                      borderRadius: 6,
                      height: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        background: '#3b82f6',
                        width: `${uploadProgress}%`,
                        height: '100%',
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          <div className="modal-form-actions">
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
      </Modal>

      <Modal
        isOpen={editLessonModalOpen}
        onClose={() => !editLessonLoading && setEditLessonModalOpen(false)}
        title="تعديل الدرس"
        size="xl"
      >
        <form onSubmit={submitEditLesson} className="space-y-4">
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
                      <option value="aws">AWS S3</option>
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

          <div className="modal-form-actions">
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
      </Modal>

      <Modal
        isOpen={noteModalOpen}
        onClose={() => !noteActionLoading && setNoteModalOpen(false)}
        title={editingNote ? 'تعديل ملف' : 'إضافة ملف مرفق'}
        size="md"
      >
        <form onSubmit={submitNote} className="space-y-4">
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
          <div className="modal-form-actions">
            <Button type="submit" variant="primary" loading={noteActionLoading}>
              {editingNote ? 'حفظ' : 'رفع الملف'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setNoteModalOpen(false)}>
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={examModalOpen}
        onClose={() => !examActionLoading && setExamModalOpen(false)}
        title={editingExam ? 'تعديل امتحان' : 'إنشاء امتحان جديد'}
        size="md"
      >
        <form onSubmit={submitExam} className="space-y-4">
          {examError && <div className="login-error">{examError}</div>}
          <Input
            label="عنوان الامتحان"
            value={examForm.title}
            onChange={(e) => setExamForm((f) => ({ ...f, title: e.target.value }))}
            required
            fullWidth
          />
          <div>
            <label className="input-label">الوصف (اختياري)</label>
            <textarea
              className="input-field"
              rows={3}
              value={examForm.description}
              onChange={(e) => setExamForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="input-label">
              {editingExam ? 'ملف الامتحان (اتركه فارغاً للإبقاء على الملف الحالي)' : 'ملف الامتحان'}
            </label>
            <input
              type="file"
              className="input-field"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,application/pdf,application/zip"
              onChange={(e) => setExamFile(e.target.files?.[0] || null)}
              required={!editingExam}
            />
            <p className="text-xs text-gray-500 mt-1">PDF, Word, PowerPoint أو ZIP — بحد أقصى 10 ميجابايت</p>
          </div>

          <div className="modal-form-actions mt-4">
            <Button type="submit" variant="primary" loading={examActionLoading}>
              {editingExam ? 'حفظ' : 'إنشاء الامتحان'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setExamModalOpen(false)}>
              إلغاء
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CourseDetails;

