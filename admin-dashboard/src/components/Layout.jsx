import { useState, useEffect } from 'react'
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const departmentPaths = ['/departments', '/years', '/semesters', '/subjects']

const navItems = [
  { to: '/', label: 'لوحة التحكم', icon: '📊' },
  { to: '/students', label: 'الطلاب', icon: '👥' },
  { to: '/instructors', label: 'المعلمون', icon: '👨‍🏫' },
  { to: '/courses', label: 'الكورسات', icon: '📚' },
  { to: '/course-sections', label: 'وحدات الكورسات', icon: '📑' },
  {
    group: 'department',
    label: 'القسم الدراسي',
    icon: '🏛️',
    children: [
      { to: '/departments', label: 'الأقسام', icon: '🏛️' },
      { to: '/years', label: 'السنوات', icon: '📅' },
      { to: '/semesters', label: 'الفصول', icon: '📆' },
      { to: '/subjects', label: 'المواد', icon: '📖' },
    ],
  },
  { to: '/banners', label: 'البانرات', icon: '🖼️' },
  { to: '/chat-groups', label: 'مجموعات الدردشة', icon: '💬' },
  { to: '/notifications', label: 'الإشعارات', icon: '🔔' },
  { to: '/reports', label: 'التقارير', icon: '📈' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [departmentOpen, setDepartmentOpen] = useState(false)

  useEffect(() => {
    if (departmentPaths.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))) {
      setDepartmentOpen(true)
    }
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const linkClass = (isActive) =>
    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
      isActive ? 'bg-primary-600 text-white shadow-glow' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-dark text-white flex flex-col shrink-0 border-l border-surface-border">
        <div className="p-6 border-b border-surface-border">
          <h1 className="font-display font-bold text-xl text-white">ساوى</h1>
          <p className="text-xs text-slate-400 mt-0.5">لوحة الإدارة</p>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto sidebar-scroll">
          {navItems.map((item) =>
            item.group === 'department' ? (
              <div key={item.group}>
                <button
                  type="button"
                  onClick={() => setDepartmentOpen((o) => !o)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    departmentPaths.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'))
                      ? 'bg-primary-600/20 text-primary-300'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-lg">{item.icon}</span>
                    {item.label}
                  </span>
                  <span className={`transition-transform duration-200 ${departmentOpen ? 'rotate-180' : ''}`}>▼</span>
                </button>
                {departmentOpen && (
                  <div className="mt-1 mr-2 space-y-0.5 border-r-2 border-slate-700/50 pr-2">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.to === '/'}
                        className={({ isActive }) => linkClass(isActive)}
                      >
                        <span className="text-base opacity-80">{child.icon}</span>
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => linkClass(isActive)}>
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </NavLink>
            )
          )}
        </nav>
        <div className="p-4 border-t border-surface-border">
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-800/50">
            <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center text-sm font-bold text-white">
              {user?.full_name?.charAt(0) || 'أ'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            خروج
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-slate-50 to-white">
        <header className="h-16 bg-white/80 backdrop-blur-sm border-b border-slate-200/80 flex items-center justify-between px-8 shrink-0">
          <p className="text-slate-600 font-medium">مرحباً، <span className="text-slate-800 font-semibold">{user?.full_name}</span></p>
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-sm font-bold">
            {user?.full_name?.charAt(0) || 'أ'}
          </div>
        </header>
        <main className="flex-1 p-6 sm:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
