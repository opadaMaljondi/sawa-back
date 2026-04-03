import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { coursesAPI } from '../../services/api';

const VideoPlayer = () => {
  const { t } = useTranslation();
  const { courseId, lessonId } = useParams();
  const [course, setCourse] = useState(null);
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await coursesAPI.getById(courseId);
        setCourse(data);

        const allLessons =
          (data.sections || []).reduce(
            (acc, sec) => acc.concat(sec.lessons || []),
            [],
          ) || [];

        const found = allLessons.find((l) => String(l.id) === String(lessonId));
        if (!found) {
          setError('لم يتم العثور على هذا الدرس داخل الكورس');
        } else {
          setLesson(found);
        }
      } catch (e) {
        console.error(e);
        setError('فشل تحميل بيانات الدرس');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [courseId, lessonId]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">جاري تحميل مشغل الفيديو...</div>;
  }

  if (error || !lesson) {
    return (
      <div className="p-6">
        <div className="mb-4">
          <Link to={`/courses/${courseId}`}>
            <Button variant="outline">{t('common.back') || 'رجوع للكورس'}</Button>
          </Link>
        </div>
        <div className="text-sm text-red-600">{error || 'لم يتم العثور على الدرس'}</div>
      </div>
    );
  }

  const renderPlayer = () => {
    if (lesson.video_provider === 'youtube' && lesson.video_embed_url) {
      return (
        <div
          className="w-full bg-black rounded-lg overflow-hidden"
          style={{ height: '70vh', maxHeight: 'calc(100vh - 180px)' }}
        >
          <iframe
            src={lesson.video_embed_url}
            title={lesson.title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    if (
      (lesson.video_provider === 'local' || lesson.video_provider === 'aws') &&
      lesson.video_playback_url
    ) {
      return (
        <div
          className="w-full bg-black rounded-lg overflow-hidden flex items-center justify-center"
          style={{ height: '70vh', maxHeight: 'calc(100vh - 180px)' }}
        >
          <video
            src={lesson.video_playback_url}
            controls
            className="max-w-full max-h-full"
            title={lesson.title}
          >
            المتصفح لا يدعم تشغيل هذا الفيديو.
          </video>
        </div>
      );
    }

    return (
      <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
        لا يمكن تشغيل هذا الفيديو من لوحة التحكم حالياً. نوع المزود: {lesson.video_provider || 'غير معروف'}
      </div>
    );
  };

  return (
    <div className="students-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">مشغل الفيديو</h1>
          <p className="page-subtitle">
            {course?.title ? `${course.title} - ` : ''}{lesson.title}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/courses/${courseId}`}>
            <Button variant="outline">{t('common.back') || 'رجوع للكورس'}</Button>
          </Link>
        </div>
      </div>

      <div className="dashboard-grid">
        <Card>
          <div className="p-4 space-y-4">
            {renderPlayer()}
            <div className="text-sm space-y-1">
              <p>
                <strong>عنوان الدرس:</strong> {lesson.title}
              </p>
              {lesson.video_playback_url && lesson.video_provider === 'youtube' && (
                <p>
                  <strong>رابط YouTube: </strong>
                  <a href={lesson.video_playback_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                    افتح في YouTube
                  </a>
                </p>
              )}
              {lesson.video_playback_url &&
                (lesson.video_provider === 'local' || lesson.video_provider === 'aws') && (
                  <p>
                    <strong>رابط الملف: </strong>
                    <a href={lesson.video_playback_url} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                      فتح الرابط
                    </a>
                  </p>
                )}
              <p>
                <strong>مزود الفيديو:</strong> {lesson.video_provider || 'غير محدد'}
              </p>
              <p>
                <strong>مجاني:</strong> {lesson.is_free ? 'نعم' : 'لا'}
              </p>
              <p>
                <strong>حالة الموافقة:</strong> {lesson.approval_status || 'pending'}
              </p>
              <p>
                <strong>نشط:</strong> {lesson.active ? 'نعم' : 'لا'}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default VideoPlayer;

