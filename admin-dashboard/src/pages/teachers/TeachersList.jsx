import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit, Trash2, Eye, UserMinus } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { teachersAPI, academicAPI } from '../../services/api';
import '../students/StudentsList.css';

const TeachersList = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [activeFilter, setActiveFilter] = useState('');
    const [departments, setDepartments] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
        return () => clearTimeout(id);
    }, [searchInput]);

    useEffect(() => {
        academicAPI.getDepartments({ per_page: 500 }).then((res) => {
            setDepartments(res.data || []);
        }).catch(() => setDepartments([]));
    }, []);

    const fetchTeachers = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            setError('');
            const params = { page };
            if (debouncedSearch) params.search = debouncedSearch;
            if (departmentId) params.department_id = departmentId;
            if (activeFilter === 'active') params.active = true;
            else if (activeFilter === 'inactive') params.active = false;
            const res = await teachersAPI.getAll(params);
            setTeachers(res.data || []);
            setPagination({ current_page: res.current_page, last_page: res.last_page });
        } catch (e) {
            console.error(e);
            setError('فشل تحميل قائمة الأساتذة');
            setTeachers([]);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, departmentId, activeFilter]);

    useEffect(() => {
        fetchTeachers(1);
    }, [fetchTeachers]);

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
                    onClick={() => navigate('/teachers/new')}
                >
                    {t('teachers.addTeacher')}
                </Button>
            </div>

            <Card>
                <div className="table-controls table-controls-filters">
                    <Input
                        placeholder={t('common.search')}
                        icon={<Search size={18} />}
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="search-input"
                    />
                    <select
                        className="filter-select"
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        aria-label={t('nav.departments')}
                    >
                        <option value="">{t('nav.departments')}: {t('common.all')}</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                    <select
                        className="filter-select"
                        value={activeFilter}
                        onChange={(e) => setActiveFilter(e.target.value)}
                        aria-label={t('common.status')}
                    >
                        <option value="">{t('common.status')}: {t('common.all')}</option>
                        <option value="active">{t('coupon.activeOnly')}</option>
                        <option value="inactive">{t('coupon.inactiveOnly')}</option>
                    </select>
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
