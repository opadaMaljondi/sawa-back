import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Filter, Edit, Trash2, Eye, UserMinus } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { teachersAPI } from '../../services/api';

const TeachersList = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [teachers, setTeachers] = useState([]);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchTeachers = async (page = 1) => {
        try {
            setLoading(true);
            setError('');
            const res = await teachersAPI.getAll({ page });
            setTeachers(res.data || []);
            setPagination({ current_page: res.current_page, last_page: res.last_page });
        } catch (e) {
            console.error(e);
            setError('فشل تحميل قائمة الأساتذة');
            setTeachers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSuspend = async (teacherId) => {
        try {
            await teachersAPI.toggleSuspend(teacherId);
            await fetchTeachers(pagination.current_page || 1);
        } catch (e) {
            console.error(e);
            alert('فشل تغيير حالة الأستاذ');
        }
    };

    const handleDelete = async (teacherId) => {
        if (!window.confirm(t('messages.confirmDelete'))) return;
        try {
            await teachersAPI.delete(teacherId);
            await fetchTeachers(pagination.current_page || 1);
        } catch (e) {
            console.error(e);
            alert(e.response?.data?.message || 'فشل حذف الأستاذ');
        }
    };

    useEffect(() => {
        fetchTeachers(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="students-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('teachers.title')}</h1>
                    <p className="page-subtitle">{t('teachers.teacherList')}</p>
                </div>
                <Button
                    variant="primary"
                    icon={<Plus size={18} />}
                    onClick={() => window.location.href = '/teachers/new'}
                >
                    {t('teachers.addTeacher')}
                </Button>
            </div>

            <Card>
                <div className="table-controls">
                    <Input
                        placeholder={t('common.search')}
                        icon={<Search size={18} />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                    <Button variant="outline" icon={<Filter size={18} />}>
                        {t('common.filter')}
                    </Button>
                </div>

                {loading ? (
                    <div className="p-6 text-center text-sm text-gray-500">جاري تحميل الأساتذة...</div>
                ) : error ? (
                    <div className="p-6 text-center text-sm text-red-600">{error}</div>
                ) : (
                    <>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('teachers.firstName')}</th>
                                        <th>{t('teachers.email')}</th>
                                        <th>{t('teachers.phone')}</th>
                                        <th>{t('teachers.assignedCourses')}</th>
                                        <th>{t('common.status')}</th>
                                        <th>{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {teachers.map((teacher) => (
                                        <tr key={teacher.id}>
                                            <td className="font-medium">{teacher.full_name || teacher.name}</td>
                                            <td>{teacher.email}</td>
                                            <td>{teacher.phone}</td>
                                            <td>{teacher.courses?.length ?? 0}</td>
                                            <td>
                                                <span className={`status-badge status-${teacher.active ? 'active' : 'inactive'}`}>
                                                    {teacher.active ? t('common.active') : t('common.inactive')}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="table-actions">
                                                    <button
                                                        className="action-btn action-btn-view"
                                                        title={t('common.view')}
                                                        onClick={() => navigate(`/teachers/${teacher.id}`)}
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        className="action-btn action-btn-edit"
                                                        title={teacher.active ? 'إيقاف الأستاذ' : 'تفعيل الأستاذ'}
                                                        style={{ color: teacher.active ? 'var(--color-warning-600)' : 'var(--color-success-600)' }}
                                                        onClick={() => handleToggleSuspend(teacher.id)}
                                                    >
                                                        <UserMinus size={16} />
                                                    </button>
                                                    <button
                                                        className="action-btn action-btn-delete"
                                                        title={t('common.delete')}
                                                        onClick={() => handleDelete(teacher.id)}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="table-pagination">
                            <p className="pagination-info">
                                صفحة {pagination.current_page} من {pagination.last_page}
                            </p>
                            <div className="pagination-controls">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.current_page <= 1}
                                    onClick={() => fetchTeachers(pagination.current_page - 1)}
                                >
                                    {t('common.previous')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.current_page >= pagination.last_page}
                                    onClick={() => fetchTeachers(pagination.current_page + 1)}
                                >
                                    {t('common.next')}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </Card>
        </div>
    );
};

export default TeachersList;
