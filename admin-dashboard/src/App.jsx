import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import Instructors from './pages/Instructors'
import Courses from './pages/Courses'
import Departments from './pages/Departments'
import Years from './pages/Years'
import Semesters from './pages/Semesters'
import Subjects from './pages/Subjects'
import Banners from './pages/Banners'
import CourseSections from './pages/CourseSections'
import ChatGroups from './pages/ChatGroups'
import Notifications from './pages/Notifications'
import Reports from './pages/Reports'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="students" element={<Students />} />
        <Route path="instructors" element={<Instructors />} />
        <Route path="courses" element={<Courses />} />
        <Route path="departments" element={<Departments />} />
        <Route path="years" element={<Years />} />
        <Route path="semesters" element={<Semesters />} />
        <Route path="subjects" element={<Subjects />} />
        <Route path="banners" element={<Banners />} />
        <Route path="course-sections" element={<CourseSections />} />
        <Route path="chat-groups" element={<ChatGroups />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="reports" element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
