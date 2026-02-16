import axios from 'axios';

// Base URL for the Laravel API (e.g. http://localhost:8000/api)
// Configure from Vite env: VITE_API_URL
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL,
  timeout: 10000,
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
  recentEnrollments: () => api.get('/admin/dashboard/recent-enrollments'),
};

// Students (Admin\StudentController @ /api/admin/students)
export const studentsAPI = {
  getAll: (params) => api.get('/admin/students', { params }),
  getById: (id) => api.get(`/admin/students/${id}`),
  create: (data) => api.post('/admin/students', data),
  update: (id, data) => api.put(`/admin/students/${id}`, data),
  enroll: (id, data) => api.post(`/admin/students/${id}/enroll`, data),
  updateWallet: (id, data) => api.post(`/admin/students/${id}/wallet`, data),
  toggleBan: (id) => api.post(`/admin/students/${id}/toggle-ban`),
};

// Instructors (teachers) (Admin\InstructorController @ /api/admin/instructors)
export const teachersAPI = {
  getAll: (params) => api.get('/admin/instructors', { params }),
  getById: (id) => api.get(`/admin/instructors/${id}`),
  create: (data) => api.post('/admin/instructors', data),
  updatePermissions: (id, data) => api.put(`/admin/instructors/${id}/permissions`, data),
  toggleSuspend: (id) => api.post(`/admin/instructors/${id}/toggle-suspend`),
  createCourse: (id, data) => api.post(`/admin/instructors/${id}/courses`, data),
};

// Courses (Admin\CourseController @ /api/admin/courses)
export const coursesAPI = {
  getAll: (params) => api.get('/admin/courses', { params }),
  getById: (id) => api.get(`/admin/courses/${id}`),
  create: (data) => api.post('/admin/courses', data),
  update: (id, data) => api.put(`/admin/courses/${id}`, data),
  delete: (id) => api.delete(`/admin/courses/${id}`),
  approve: (id) => api.post(`/admin/courses/${id}/approve`),
  reject: (id, data) => api.post(`/admin/courses/${id}/reject`, data),
  suspend: (id) => api.post(`/admin/courses/${id}/suspend`),
  activate: (id) => api.post(`/admin/courses/${id}/activate`),
  stats: (id) => api.get(`/admin/courses/${id}/stats`),
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
  upload: (formData) =>
    api.post('/admin/videos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (lessonId, data) => api.put(`/admin/videos/${lessonId}`, data),
  delete: (lessonId) => api.delete(`/admin/videos/${lessonId}`),
};

// Academic structure (departments / years / semesters / subjects)
export const academicAPI = {
  getDepartments: (params) => api.get('/admin/departments', { params }),
  createDepartment: (data) => api.post('/admin/departments', data),
  updateDepartment: (id, data) => api.put(`/admin/departments/${id}`, data),
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

// Auth (shared login for admin/instructor/student)
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  registerStudent: (data) => api.post('/auth/register', data),
  logout: () => api.post('/logout'),
};

export default api;
