import axios from 'axios';

// Base URL for the Laravel API (e.g. http://localhost:8000/api)
// Configure from Vite env: VITE_API_URL
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const storageURL = import.meta.env.VITE_STORAGE_URL || baseURL.replace('/api', '/storage');

let cachedVideoChunkBytes = null;
let cachedVideoChunkBytesAt = 0;
const VIDEO_CHUNK_CACHE_MS = 120000;

/**
 * حجم جزء الرفع بالبايت — يُقرأ من السيرفر (config video.chunk_max_kb) مع تخزين مؤقت.
 * يقلل طلبات HTTP مقارنة بجزء أصغر = رفع أسرع فعلياً على نفس السرعة.
 */
export async function getVideoUploadChunkBytes() {
  const now = Date.now();
  if (cachedVideoChunkBytes != null && now - cachedVideoChunkBytesAt < VIDEO_CHUNK_CACHE_MS) {
    return cachedVideoChunkBytes;
  }
  try {
    const lim = await axios.get(`${baseURL.replace(/\/$/, '')}/app/video-upload-limits`, {
      timeout: 8000,
    });
    const kb = Number(lim.data?.chunk_max_kb);
    if (Number.isFinite(kb) && kb >= 1024) {
      cachedVideoChunkBytes = Math.floor(kb * 1024);
      cachedVideoChunkBytesAt = now;
      return cachedVideoChunkBytes;
    }
  } catch {
    /* ignore */
  }
  cachedVideoChunkBytes = 32 * 1024 * 1024;
  cachedVideoChunkBytesAt = now;
  return cachedVideoChunkBytes;
}

// Create axios instance with default config
const api = axios.create({
  baseURL,
  timeout: 25000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Sanctum token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: unwrap data and handle 401
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// ----- Admin APIs -----

// Dashboard
export const dashboardAPI = {
  stats: () => api.get('/admin/dashboard/stats'),
  topCourses: () => api.get('/admin/dashboard/top-courses'),
  recentCourses: (params) => api.get('/admin/dashboard/recent-courses', { params }),
  recentEnrollments: () => api.get('/admin/dashboard/recent-enrollments'),
  couponStats: () => api.get('/admin/dashboard/coupon-stats'),
  supportMessages: (params) => api.get('/admin/dashboard/support', { params }),
  updateSupportStatus: (id, status) =>
    api.put(`/admin/dashboard/support/${id}/status`, { status }),
};

// Students (Admin\StudentController @ /api/admin/students)
export const studentsAPI = {
  getAll: (params) => api.get('/admin/students', { params }),
  getById: (id) => api.get(`/admin/students/${id}`),
  /** Lightweight profile for wallet QR scan page (no enrollments). */
  walletQrPreview: (id) => api.get(`/admin/students/${id}/wallet-qr-preview`),
  create: (data) => {
    if (data instanceof FormData) {
      return api.post('/admin/students', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/admin/students', data);
  },
  update: (id, data) => {
    if (data instanceof FormData) {
      if (!data.has('_method')) data.append('_method', 'PUT');
      return api.post(`/admin/students/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/admin/students/${id}`, data);
  },
  enroll: (id, data) => api.post(`/admin/students/${id}/enroll`, data),
  updateWallet: (id, data) => api.post(`/admin/students/${id}/wallet`, data),
  toggleBan: (id) => api.post(`/admin/students/${id}/toggle-ban`),
  delete: (id) => api.delete(`/admin/students/${id}`),
};

// Wallets (Admin\WalletController)
export const walletsAPI = {
  list: (params) => api.get('/admin/wallets', { params }),
  transactions: (params) => api.get('/admin/wallets/transactions', { params }),
  show: (userId) => api.get(`/admin/wallets/${userId}`),
  adjust: (userId, data) => api.post(`/admin/wallets/${userId}/adjust`, data),
};

// Finance aggregates (Admin\FinanceController)
export const financeAPI = {
  getPlatformTotals: () => api.get('/admin/finance/platform-totals'),
};

// Instructors (teachers) (Admin\InstructorController @ /api/admin/instructors)
export const teachersAPI = {
  getAll: (params) => api.get('/admin/instructors', { params }),
  getFinanceSummary: (params) => api.get('/admin/instructors/finance-summary', { params }),
  getById: (id) => api.get(`/admin/instructors/${id}`),
  create: (data) => {
    if (data instanceof FormData) {
      return api.post('/admin/instructors', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/admin/instructors', data);
  },
  update: (id, data) => {
    if (data instanceof FormData) {
      if (!data.has('_method')) data.append('_method', 'PUT');
      return api.post(`/admin/instructors/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/admin/instructors/${id}`, data);
  },
  updatePermissions: (id, data) => api.put(`/admin/instructors/${id}/permissions`, data),
  getWalletOverview: (id) => api.get(`/admin/instructors/${id}/wallet-overview`),
  updateWallet: (id, data) => api.post(`/admin/instructors/${id}/wallet`, data),
  toggleSuspend: (id) => api.post(`/admin/instructors/${id}/toggle-suspend`),
  createCourse: (id, data) => api.post(`/admin/instructors/${id}/courses`, data),
  delete: (id) => api.delete(`/admin/instructors/${id}`),
};

// Courses (Admin\CourseController @ /api/admin/courses)
export const coursesAPI = {
  getAll: (params) => api.get('/admin/courses', { params }),
  getById: (id) => api.get(`/admin/courses/${id}`),
  create: (data) => {
    if (data instanceof FormData) {
      return api.post('/admin/courses', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/admin/courses', data);
  },
  update: (id, data) => {
    if (data instanceof FormData) {
      if (!data.has('_method')) data.append('_method', 'PUT');
      return api.post(`/admin/courses/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/admin/courses/${id}`, data);
  },
  delete: (id) => api.delete(`/admin/courses/${id}`),
  approve: (id) => api.post(`/admin/courses/${id}/approve`),
  reject: (id, data) => api.post(`/admin/courses/${id}/reject`, data),
  suspend: (id) => api.post(`/admin/courses/${id}/suspend`),
  activate: (id) => api.post(`/admin/courses/${id}/activate`),
  stats: (id) => api.get(`/admin/courses/${id}/stats`),
  getSubscriptions: (id, params) =>
    api.get(`/admin/courses/${id}/subscriptions`, { params }),
  makeFirstFree: (id) => api.post(`/admin/courses/${id}/make-first-free`),
};

// Course sections (Admin\CourseSectionController)
export const courseSectionsAPI = {
  getAll: (params) => api.get('/admin/course-sections', { params }),
  getById: (id) => api.get(`/admin/course-sections/${id}`),
  create: (data) => api.post('/admin/course-sections', data),
  update: (id, data) => api.put(`/admin/course-sections/${id}`, data),
  delete: (id) => api.delete(`/admin/course-sections/${id}`),
};

// Videos / Lessons (Admin\VideoController)
export const videosAPI = {
  upload: (formData, onUploadProgress) =>
    api.post('/admin/videos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0, // no timeout for large video uploads
      onUploadProgress,
    }),
  /** Resume: next_chunk_index, received_chunk_indices, all_chunks_received, … */
  getChunkUploadStatus: (params) => api.get('/admin/videos/chunk/status', { params }),
  /** After async chunk complete: status queued|processing|completed|failed */
  getChunkMergeStatus: (params) => api.get('/admin/videos/chunk/merge-status', { params }),
  /** Delete partial chunks on server (cancel session). */
  abandonChunkUpload: (params) =>
    api.delete('/admin/videos/chunk/session', { params }),
  /** One part of a chunked upload (local / aws). */
  uploadChunk: (formData, onUploadProgress, signal) =>
    api.post('/admin/videos/chunk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
      onUploadProgress,
      signal,
    }),
  /** Merge chunks and create lesson (local / aws). */
  completeChunkUpload: (formData, onUploadProgress) =>
    api.post('/admin/videos/chunk/complete', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
      onUploadProgress,
    }),
  update: (lessonId, data) => {
    if (data instanceof FormData) {
      if (!data.has('_method')) data.append('_method', 'PUT');
      return api.post(`/admin/videos/${lessonId}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/admin/videos/${lessonId}`, data);
  },
  delete: (lessonId) => api.delete(`/admin/videos/${lessonId}`),
};

/**
 * فيديوهات الأستاذ (نفس عقود الرفع المجزأ كالأدمن؛ المسار /api/instructor/videos/*).
 * يُستخدم مع توكن الأستاذ (Bearer في localStorage أو عميل منفصل).
 */
export const instructorVideosAPI = {
  upload: (formData, onUploadProgress) =>
    api.post('/instructor/videos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
      onUploadProgress,
    }),
  getChunkUploadStatus: (params) => api.get('/instructor/videos/chunk/status', { params }),
  getChunkMergeStatus: (params) => api.get('/instructor/videos/chunk/merge-status', { params }),
  abandonChunkUpload: (params) =>
    api.delete('/instructor/videos/chunk/session', { params }),
  uploadChunk: (formData, onUploadProgress, signal) =>
    api.post('/instructor/videos/chunk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
      onUploadProgress,
      signal,
    }),
  completeChunkUpload: (formData, onUploadProgress) =>
    api.post('/instructor/videos/chunk/complete', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
      onUploadProgress,
    }),
  update: (lessonId, data) => {
    if (data instanceof FormData) {
      if (!data.has('_method')) data.append('_method', 'PUT');
      return api.post(`/instructor/videos/${lessonId}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/instructor/videos/${lessonId}`, data);
  },
  delete: (lessonId) => api.delete(`/instructor/videos/${lessonId}`),
  makeFirstFree: (courseId) =>
    api.post(`/instructor/courses/${courseId}/make-first-free`),
};

// Academic structure (departments / years / semesters / subjects)
export const academicAPI = {
  getDepartments: (params) => api.get('/admin/departments', { params }),
  getDepartmentById: (id) => api.get(`/admin/departments/${id}`),
  createDepartment: (data) => api.post('/admin/departments', data, {
    headers: { 'Content-Type': data instanceof FormData ? 'multipart/form-data' : 'application/json' }
  }),
  updateDepartment: (id, data) => {
    if (data instanceof FormData) {
      if (!data.has('_method')) data.append('_method', 'PUT');
      return api.post(`/admin/departments/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return api.put(`/admin/departments/${id}`, data);
  },
  deleteDepartment: (id) => api.delete(`/admin/departments/${id}`),

  getYears: (params) => api.get('/admin/years', { params }),
  createYear: (data) => api.post('/admin/years', data),
  updateYear: (id, data) => api.put(`/admin/years/${id}`, data),
  deleteYear: (id) => api.delete(`/admin/years/${id}`),

  getSemesters: (params) => api.get('/admin/semesters', { params }),
  createSemester: (data) => api.post('/admin/semesters', data),
  updateSemester: (id, data) => api.put(`/admin/semesters/${id}`, data),
  deleteSemester: (id) => api.delete(`/admin/semesters/${id}`),

  getSubjects: (params) => api.get('/admin/subjects', { params }),
  createSubject: (data) => api.post('/admin/subjects', data),
  updateSubject: (id, data) => api.put(`/admin/subjects/${id}`, data),
  deleteSubject: (id) => api.delete(`/admin/subjects/${id}`),
};

// Subscriptions (Admin\Enrollment/SubscriptionController)
export const subscriptionsAPI = {
  getAll: (params) => api.get('/admin/subscriptions', { params }),
  toggleStatus: (id) => api.post(`/admin/subscriptions/${id}/toggle-status`),
};

// Banners (Admin\BannerController)
export const bannersAPI = {
  getAll: () => api.get('/admin/banners'),
  create: (formData) => api.post('/admin/banners', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id, formData) => {
    // If it's FormData (has file), we use POST with _method=PUT
    if (formData instanceof FormData) {
      if (!formData.has('_method')) formData.append('_method', 'PUT');
      return api.post(`/admin/banners/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return api.put(`/admin/banners/${id}`, formData);
  },
  delete: (id) => api.delete(`/admin/banners/${id}`),
};

// Roles and Permissions
export const permissionsAPI = {
  getRoles: () => api.get('/admin/roles'),
  getPermissions: () => api.get('/admin/permissions'),
  createRole: (data) => api.post('/admin/roles', data),
  updateRole: (id, data) => api.put(`/admin/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/admin/roles/${id}`),
  syncPermissions: (id, permissions) => api.post(`/admin/roles/${id}/permissions`, { permissions }),
};

// Referrals (admin)
export const referralsAPI = {
  list: (params) => api.get('/admin/referrals', { params }),
  stats: () => api.get('/admin/referrals/stats'),
};

// Settings
export const settingsAPI = {
  getAll: () => api.get('/admin/settings'),
  update: (data) => api.post('/admin/settings', data),
};

// Admin Profile
export const adminAPI = {
  getProfile: () => api.get('/admin/profile'),
  updateProfile: (data) => api.post('/admin/profile', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
};

// Notifications
export const notificationsAPI = {
  send: (data) => api.post('/admin/notifications/send', data),
  getNotifications: (page = 1) => api.get(`/admin/notifications?page=${page}`),
  getUnreadCount: () =>
    api.get('/admin/notifications/unread-count', {
      timeout: 90000,
    }),
  markAsRead: (id) => api.post(`/admin/notifications/${id}/read`),
};

// Coupons (admin)
export const couponsAPI = {
  list: (params) => api.get('/admin/coupons', { params }),
  create: (data) => api.post('/admin/coupons', data),
  update: (id, data) => api.put(`/admin/coupons/${id}`, data),
  delete: (id) => api.delete(`/admin/coupons/${id}`),
};

// Notes / Files
export const notesAPI = {
  listAll: () => api.get('/admin/notes'),
  getAll: (courseId) => api.get(`/admin/courses/${courseId}/notes`),
  create: (data) => api.post('/admin/notes', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.put(`/admin/notes/${id}`, data),
  delete: (id) => api.delete(`/admin/notes/${id}`),
};

// Exams (multipart: title, description, attachment file)
export const examsAPI = {
  getAll: (courseId) => api.get(`/admin/courses/${courseId}/exams`),
  create: (data) => {
    if (data instanceof FormData) {
      return api.post('/admin/exams', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/admin/exams', data);
  },
  update: (id, data) => {
    if (data instanceof FormData) {
      if (!data.has('_method')) data.append('_method', 'PUT');
      return api.post(`/admin/exams/${id}`, data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put(`/admin/exams/${id}`, data);
  },
  delete: (id) => api.delete(`/admin/exams/${id}`),
};

// Auth (shared login for admin/instructor/student)
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  registerStudent: (data) => api.post('/auth/register', data),
  logout: () => api.post('/logout'),
};

export { baseURL, storageURL };
export default api;
