import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, GraduationCap, BookOpen, CreditCard, TrendingUp } from 'lucide-react';
import Card from '../components/common/Card';
import StatCard from '../components/common/StatCard';
import { dashboardAPI } from '../services/api';
import { formatDateTime } from '../utils/date';
import './Dashboard.css';

const Dashboard = () => {
    const { t, i18n } = useTranslation();
    const [stats, setStats] = useState(null);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true);
                const [statsRes, recentRes] = await Promise.all([
                    dashboardAPI.stats(),
                    dashboardAPI.recentEnrollments()
                ]);
                setStats(statsRes.stats || statsRes);
                // recentEnrollments: كل عملية اشتراك → نشاط
                const items = (recentRes || []).map((enr) => ({
                    id: enr.id,
                    action: `${enr.course?.title || 'كورس'} - اشتراك جديد`,
                    user: enr.student?.full_name || enr.student?.email || '',
                    time: formatDateTime(enr.enrolled_at, i18n.language),
                }));
                setActivities(items);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const statCards = stats
        ? [
            {
                title: t('students.totalStudents'),
                value: stats.total_students?.toLocaleString() || '0',
                icon: <Users size={24} />,
                color: 'primary',
                trend: 'up',
                trendValue: ''
            },
            {
                title: t('teachers.totalTeachers'),
                value: stats.total_instructors?.toLocaleString() || '0',
                icon: <GraduationCap size={24} />,
                color: 'success',
                trend: 'up',
                trendValue: ''
            },
            {
                title: t('courses.totalCourses'),
                value: stats.total_courses?.toLocaleString() || '0',
                icon: <BookOpen size={24} />,
                color: 'warning',
                trend: 'up',
                trendValue: ''
            },
            {
                title: t('subscriptions.activeSubscriptions'),
                value: stats.total_enrollments?.toLocaleString() || '0',
                icon: <CreditCard size={24} />,
                color: 'secondary',
                trend: 'up',
                trendValue: ''
            }
        ]
        : [];

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <div>
                    <h1 className="dashboard-title">{t('dashboard.welcome')}</h1>
                    <p className="dashboard-subtitle">{t('dashboard.overview')}</p>
                </div>
            </div>

            <div className="dashboard-stats">
                {loading && !stats && (
                    <div className="p-4 text-sm text-gray-500">جاري تحميل الإحصائيات...</div>
                )}
                {!loading && statCards.map((stat, index) => (
                    <StatCard key={index} {...stat} />
                ))}
            </div>

            <div className="dashboard-grid">
                <Card title={t('dashboard.recentActivities')} className="dashboard-activities">
                    <div className="activities-list">
                        {loading && !activities.length && (
                            <p className="p-4 text-sm text-gray-500">جاري تحميل الأنشطة...</p>
                        )}
                        {!loading && !activities.length && (
                            <p className="p-4 text-sm text-gray-500">لا توجد اشتراكات حديثة.</p>
                        )}
                        {activities.map((activity) => (
                            <div key={activity.id} className="activity-item">
                                <div className="activity-icon">
                                    <TrendingUp size={16} />
                                </div>
                                <div className="activity-content">
                                    <p className="activity-action">{activity.action}</p>
                                    <p className="activity-meta">
                                        <span className="activity-user">{activity.user}</span>
                                        <span className="activity-time">{activity.time}</span>
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card title={t('dashboard.quickActions')} className="dashboard-quick-actions">
                    <div className="quick-actions-grid">
                        <a href="/students/new" className="quick-action-card">
                            <Users size={24} />
                            <span>{t('students.addStudent')}</span>
                        </a>
                        <a href="/teachers/new" className="quick-action-card">
                            <GraduationCap size={24} />
                            <span>{t('teachers.addTeacher')}</span>
                        </a>
                        <a href="/courses/new" className="quick-action-card">
                            <BookOpen size={24} />
                            <span>{t('courses.addCourse')}</span>
                        </a>
                        <a href="/subscriptions" className="quick-action-card">
                            <CreditCard size={24} />
                            <span>{t('subscriptions.title')}</span>
                        </a>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default Dashboard;
