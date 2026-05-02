/**
 * Navigate admin dashboard from in-app notification `data` payload (REST + mirrored in FCM payloads).
 *
 * @param {import('react-router-dom').NavigateFunction} navigate
 * @param {Record<string, unknown> | null | undefined} data
 * @returns {boolean} true when navigation was performed
 */
export function navigateFromAdminNotification(navigate, data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const nav = data.admin_nav;
  if (!nav || typeof navigate !== 'function') {
    return false;
  }
  const courseId = data.course_id;
  const lessonId = data.lesson_id;

  switch (nav) {
    case 'courses_list':
      navigate('/courses');
      return true;
    case 'course_detail': {
      if (courseId === null || courseId === undefined || courseId === '') {
        return false;
      }
      const cid = String(courseId);
      if (lessonId !== null && lessonId !== undefined && lessonId !== '') {
        navigate(`/courses/${cid}/lessons/${lessonId}`);
        return true;
      }
      navigate(`/courses/${cid}`);
      return true;
    }
    case 'support':
      navigate('/support');
      return true;
    default:
      return false;
  }
}

export function adminNotificationIsClickable(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const nav = data.admin_nav;
  if (nav === 'courses_list' || nav === 'support') {
    return true;
  }
  if (
    nav === 'course_detail' &&
    data.course_id !== null &&
    data.course_id !== undefined &&
    data.course_id !== ''
  ) {
    return true;
  }
  return false;
}
