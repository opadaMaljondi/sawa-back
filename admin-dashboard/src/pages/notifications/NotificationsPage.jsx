import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Bell, Send, Users, User, BookOpen, Loader2, Info,
    Inbox, GraduationCap, CheckCircle2, Clock, Trash2,
    Check
} from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { notificationsAPI, studentsAPI, coursesAPI } from '../../services/api';
import './NotificationsPage.css';

const NotificationsPage = () => {
    const { t, i18n } = useTranslation();
    const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' or 'compose'

    // Compose State
    const [scope, setScope] = useState('general');
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [targetId, setTargetId] = useState('');
    const [students, setStudents] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loadingTargets, setLoadingTargets] = useState(false);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState({ type: '', text: '' });

    // Inbox State
    const [notifications, setNotifications] = useState([]);
    const [loadingInbox, setLoadingInbox] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);

    useEffect(() => {
        if (activeTab === 'inbox') {
            fetchInbox();
        }
    }, [activeTab, page]);

    useEffect(() => {
        const fetchData = async () => {
            setLoadingTargets(true);
            try {
                if (scope === 'user') {
                    const res = await studentsAPI.getAll();
                    setStudents(res.data || res);
                } else if (scope === 'course') {
                    const res = await coursesAPI.getAll();
                    setCourses(res.data || res);
                }
            } catch (error) {
                console.error('Error fetching targets:', error);
            } finally {
                setLoadingTargets(false);
            }
        };

        if (activeTab === 'compose' && (scope === 'user' || scope === 'course')) {
            fetchData();
        }
    }, [scope, activeTab]);

    const fetchInbox = async () => {
        setLoadingInbox(true);
        try {
            const res = await notificationsAPI.getNotifications(page);
            const data = res.data?.data || [];
            setNotifications(Array.isArray(data) ? data : []);
            setHasMore(res.data?.next_page_url !== null);
        } catch (error) {
            console.error('Error fetching inbox:', error);
            setNotifications([]);
        } finally {
            setLoadingInbox(false);
        }
    };

    const handleMarkAsRead = async (id) => {
        try {
            await notificationsAPI.markAsRead(id);
            setNotifications(prev => prev.map(n =>
                n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n
            ));
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const handleSendSubmit = async (e) => {
        e.preventDefault();
        setSending(true);
        setSendResult({ type: '', text: '' });

        try {
            const data = {
                scope,
                title,
                message,
            };

            if (scope === 'course') data.course_id = targetId;
            if (scope === 'user') data.user_id = targetId;

            await notificationsAPI.send(data);
            setSendResult({ type: 'success', text: t('notifications.sendSuccess') });
            setTitle('');
            setMessage('');
            setTargetId('');
        } catch (error) {
            console.error('Error sending notification:', error);
            const errorMsg = error.response?.data?.message || t('notifications.sendError');
            setSendResult({ type: 'error', text: errorMsg });
        } finally {
            setSending(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="notifications-page">
            <div className="page-header">
                <div className="header-info">
                    <h1 className="page-title">{t('notifications.title')}</h1>
                    <p className="page-subtitle">{t('notifications.subtitle')}</p>
                </div>
                <div className="tab-switcher">
                    <button
                        className={`tab-btn ${activeTab === 'inbox' ? 'active' : ''}`}
                        onClick={() => setActiveTab('inbox')}
                    >
                        <Inbox size={18} />
                        <span>{t('notifications.inbox')}</span>
                        {(Array.isArray(notifications) && notifications.some(n => !n.read)) && <span className="unread-dot"></span>}
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'compose' ? 'active' : ''}`}
                        onClick={() => setActiveTab('compose')}
                    >
                        <Send size={18} />
                        <span>{t('notifications.compose')}</span>
                    </button>
                </div>
            </div>

            {activeTab === 'inbox' ? (
                <div className="inbox-section animate-fade-in">
                    <div className="inbox-controls">
                        <h3>{t('notifications.received')}</h3>
                        <Button variant="outline" size="sm" icon={<Bell size={14} />} onClick={fetchInbox}>
                            {t('notifications.refresh')}
                        </Button>
                    </div>

                    <Card className="inbox-card">
                        {loadingInbox && (notifications?.length || 0) === 0 ? (
                            <div className="loading-state">
                                <Loader2 className="animate-spin" size={32} />
                                <p>{t('notifications.loading')}</p>
                            </div>
                        ) : (notifications?.length || 0) === 0 ? (
                            <div className="empty-state">
                                <Bell size={48} className="empty-icon" />
                                <p>{t('notifications.empty')}</p>
                            </div>
                        ) : (
                            <div className="notifications-list">
                                {notifications?.map(notification => (
                                    <div
                                        key={notification.id}
                                        className={`notification-item ${notification.read ? 'read' : 'unread'}`}
                                    >
                                        <div className="notif-icon-col">
                                            <div className={`type-icon ${notification.data?.type || 'system'}`}>
                                                {notification.data?.type === 'course_approval' ? <GraduationCap size={20} /> : <Bell size={20} />}
                                            </div>
                                        </div>
                                        <div className="notif-content-col">
                                            <div className="notif-header">
                                                <h4>{notification.title}</h4>
                                                <span className="notif-time">
                                                    <Clock size={12} />
                                                    {formatDate(notification.created_at)}
                                                </span>
                                            </div>
                                            <p className="notif-message">{notification.message}</p>

                                            {!notification.read && (
                                                <button
                                                    className="mark-read-btn"
                                                    onClick={() => handleMarkAsRead(notification.id)}
                                                >
                                                    <Check size={14} />
                                                    <span>{t('notifications.markAsRead')}</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="notif-badge-col">
                                            {notification.read ? (
                                                <span className="read-badge"><CheckCircle2 size={14} /> {t('notifications.read')}</span>
                                            ) : (
                                                <span className="new-badge">{t('notifications.new')}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {hasMore && (
                            <div className="load-more">
                                <Button variant="ghost" onClick={() => setPage(p => p + 1)}>
                                    {t('notifications.viewMore')}
                                </Button>
                            </div>
                        )}
                    </Card>
                </div>
            ) : (
                <div className="notifications-grid animate-fade-in">
                    <Card className="notification-form-card">
                        <form onSubmit={handleSendSubmit}>
                            <div className="form-group">
                                <label>{t('notifications.targetAudience')}</label>
                                <div className="scope-selector">
                                    <button
                                        type="button"
                                        className={`scope-btn ${scope === 'general' ? 'active' : ''}`}
                                        onClick={() => setScope('general')}
                                    >
                                        <Users size={18} />
                                        <span>{t('notifications.allUsers')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`scope-btn ${scope === 'course' ? 'active' : ''}`}
                                        onClick={() => setScope('course')}
                                    >
                                        <BookOpen size={18} />
                                        <span>{t('notifications.courseSubscribers')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`scope-btn ${scope === 'user' ? 'active' : ''}`}
                                        onClick={() => setScope('user')}
                                    >
                                        <User size={18} />
                                        <span>{t('notifications.specificUser')}</span>
                                    </button>
                                </div>
                            </div>

                            {scope === 'course' && (
                                <div className="form-group animate-fade-in">
                                    <label>{t('notifications.selectCourse')}</label>
                                    <select
                                        className="form-select"
                                        value={targetId}
                                        onChange={(e) => setTargetId(e.target.value)}
                                        required
                                    >
                                        <option value="">-- {t('notifications.selectCourse')} --</option>
                                        {courses.map(course => (
                                            <option key={course.id} value={course.id}>{course.title}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {scope === 'user' && (
                                <div className="form-group animate-fade-in">
                                    <label>{t('notifications.selectUser')}</label>
                                    <select
                                        className="form-select"
                                        value={targetId}
                                        onChange={(e) => setTargetId(e.target.value)}
                                        required
                                    >
                                        <option value="">-- {t('notifications.selectUser')} --</option>
                                        {students.map(student => (
                                            <option key={student.id} value={student.id}>{student.full_name} ({student.email})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="form-group">
                                <label>{t('notifications.notifTitle')}</label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={t('notifications.notifTitlePlaceholder')}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>{t('notifications.notifMessage')}</label>
                                <textarea
                                    className="form-textarea"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    placeholder={t('notifications.notifMessagePlaceholder')}
                                    rows="4"
                                    required
                                ></textarea>
                            </div>

                            <div className="notification-footer">
                                {sendResult.text && (
                                    <div className={`status-alert ${sendResult.type}`}>
                                        <Info size={16} />
                                        <span>{sendResult.text}</span>
                                    </div>
                                )}
                                <Button
                                    type="submit"
                                    icon={sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                                    disabled={sending || (scope !== 'general' && !targetId)}
                                    className="submit-btn"
                                >
                                    {sending ? t('notifications.sending') : t('notifications.sendNow')}
                                </Button>
                            </div>
                        </form>
                    </Card>

                    <div className="notification-info">
                        <Card className="info-card">
                            <div className="info-header">
                                <Info size={24} className="info-icon" />
                                <h3>{t('notifications.aboutTitle')}</h3>
                            </div>
                            <ul className="info-list">
                                <li>{t('notifications.aboutItem1')}</li>
                                <li>{t('notifications.aboutItem2')}</li>
                                <li>{t('notifications.aboutItem3')}</li>
                            </ul>
                        </Card>

                        <div className="notification-preview-card">
                            <h4>{t('notifications.preview')}</h4>
                            <div className="phone-preview">
                                <div className="phone-screen">
                                    <div className="status-bar">
                                        <span>9:41</span>
                                        <div className="icons">
                                            <div className="signal"></div>
                                            <div className="wifi"></div>
                                            <div className="battery"></div>
                                        </div>
                                    </div>
                                    <div className="push-notification">
                                        <div className="app-icon">
                                            <GraduationCap size={16} />
                                        </div>
                                        <div className="notification-content">
                                            <h5>{title || t('notifications.appNamePlaceholder')}</h5>
                                            <p>{message || t('notifications.messagePlaceholder')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationsPage;
