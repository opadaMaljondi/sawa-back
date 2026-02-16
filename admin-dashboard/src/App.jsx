import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import StudentsList from './pages/students/StudentsList';
import StudentDetails from './pages/students/StudentDetails';
import StudentForm from './pages/students/StudentForm';
import TeachersList from './pages/teachers/TeachersList';
import TeacherDetails from './pages/teachers/TeacherDetails';
import CoursesList from './pages/courses/CoursesList';
import CourseDetails from './pages/courses/CourseDetails';
import CourseForm from './pages/courses/CourseForm';
import VideoPlayer from './pages/courses/VideoPlayer';
import DepartmentsPage from './pages/academic/Departments';
import YearsPage from './pages/academic/Years';
import SemestersPage from './pages/academic/Semesters';
import SubjectsPage from './pages/academic/Subjects';
import Login from './pages/auth/Login';
import './assets/styles/index.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100vh' }}>
        <div
          className="animate-spin"
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid var(--border-primary)',
            borderTopColor: 'var(--color-primary-600)',
            borderRadius: '50%',
          }}
        />
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
    return (
        <BrowserRouter>
            <ThemeProvider>
                <LanguageProvider>
                    <AuthProvider>
                        <Routes>
                          <Route path="/login" element={<Login />} />
                          <Route
                            path="/"
                            element={
                              <ProtectedRoute>
                                <MainLayout />
                              </ProtectedRoute>
                            }
                          >
                            <Route index element={<Dashboard />} />
                            <Route path="students" element={<StudentsList />} />
                            <Route path="students/new" element={<StudentForm />} />
                            <Route path="students/:id" element={<StudentDetails />} />
                            <Route path="students/:id/edit" element={<StudentForm />} />
                            <Route path="teachers" element={<TeachersList />} />
                            <Route path="teachers/:id" element={<TeacherDetails />} />
                            <Route path="courses" element={<CoursesList />} />
                            <Route path="courses/new" element={<CourseForm />} />
                            <Route path="courses/:id" element={<CourseDetails />} />
                            <Route path="courses/:id/edit" element={<CourseForm />} />
                            <Route path="courses/:courseId/lessons/:lessonId" element={<VideoPlayer />} />

                            {/* Academic structure */}
                            <Route path="permissions" element={<div className="p-4"><h1>الصلاحيات - قيد التطوير</h1></div>} />
                            <Route path="subscriptions" element={<div className="p-4"><h1>الاشتراكات - قيد التطوير</h1></div>} />
                            <Route path="academic/departments" element={<DepartmentsPage />} />
                            <Route path="academic/years" element={<YearsPage />} />
                            <Route path="academic/semesters" element={<SemestersPage />} />
                            <Route path="academic/subjects" element={<SubjectsPage />} />
                            <Route path="settings" element={<div className="p-4"><h1>الإعدادات - قيد التطوير</h1></div>} />
                          </Route>
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </AuthProvider>
                </LanguageProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
}

export default App;
