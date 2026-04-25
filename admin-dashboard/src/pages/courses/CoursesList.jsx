import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit, Trash2, Eye, Video } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { coursesAPI, academicAPI, teachersAPI } from '../../services/api';
import '../students/StudentsList.css';

const CoursesList = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [subjectId, setSubjectId] = useState('');
    const [instructorId, setInstructorId] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [activeFilter, setActiveFilter] = useState('');
    const [departments, setDepartments] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [instructors, setInstructors] = useState([]);
    const [courses, setCourses] = useState([]);
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

    useEffect(() => {
        teachersAPI.getAll({ per_page: 500 }).then((res) => {
            setInstructors(res.data || []);
        }).catch(() => setInstructors([]));
    }, []);

    useEffect(() => {
        const params = { per_page: 500 };
        if (departmentId) params.department_id = departmentId;
        academicAPI.getSubjects(params).then((res) => {
            setSubjects(res.data || []);
        }).catch(() => setSubjects([]));
    }, [departmentId]);

    const fetchCourses = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            setError('');
            const params = { page };
            if (debouncedSearch) params.keyword = debouncedSearch;
            if (departmentId) params.department_id = departmentId;
            if (subjectId) params.subject_id = subjectId;
            if (instructorId) params.instructor_id = instructorId;
            if (statusFilter) params.status = statusFilter;
            if (activeFilter === 'active') params.active = true;
            else if (activeFilter === 'inactive') params.active = false;
            const res = await coursesAPI.getAll(params);
            setCourses(res.data || []);
            setPagination({ current_page: res.current_page, last_page: res.last_page });
        } catch (e) {
            console.error(e);
            setError('فشل تحميل قائمة الكورسات');
            setCourses([]);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, departmentId, subjectId, instructorId, statusFilter, activeFilter]);

    useEffect(() => {
        fetchCourses(1);
    }, [fetchCourses]);

    const statusLabel = (status) => {
        if (status === 'published') return t('courses.statePublished');
        if (status === 'pending') return t('courses.statePending');
        if (status === 'draft') return t('courses.stateDraft');
        return status || '—';
    };

    return (
        <div className="students-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('courses.title')}</h1>
                    <p className="page-subtitle">{t('courses.courseList')}</p>
                </div>
                <Button
                    variant="primary"
                    icon={<Plus size={18} />}
                    onClick={() => navigate('/courses/new')}
                >
                    {t('courses.addCourse')}
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
                        onChange={(e) => {
                            setDepartmentId(e.target.value);
                            setSubjectId('');
                        }}
                        aria-label={t('nav.departments')}
                    >
                        <option value="">{t('nav.departments')}: {t('common.all')}</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                    <select
                        className="filter-select"
                        value={subjectId}
                        onChange={(e) => setSubjectId(e.target.value)}
                        aria-label={t('nav.subjects')}
                    >
                        <option value="">{t('nav.subjects')}: {t('common.all')}</option>
                        {subjects.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <select
                        className="filter-select"
                        value={instructorId}
                        onChange={(e) => setInstructorId(e.target.value)}
                        aria-label={t('courses.instructor')}
                    >
                        <option value="">{t('courses.instructor')}: {t('common.all')}</option>
                        {instructors.map((u) => (
                            <option key={u.id} value={u.id}>{u.full_name || u.name || u.email}</option>
                        ))}
                    </select>
                    <select
                        className="filter-select"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        aria-label={t('courses.publishStatus')}
                    >
                        <option value="">{t('courses.publishStatus')}: {t('common.all')}</option>
                        <option value="draft">{t('courses.stateDraft')}</option>
                        <option value="pending">{t('courses.statePending')}</option>
                        <option value="published">{t('courses.statePublished')}</option>
                    </select>
                    <select
                        className="filter-select"
                        value={activeFilter}
                        onChange={(e) => setActiveFilter(e.target.value)}
                        aria-label={t('courses.listingActive')}
                    >
                        <option value="">{t('courses.listingActive')}: {t('common.all')}</option>
                        <option value="active">{t('coupon.activeOnly')}</option>
                        <option value="inactive">{t('coupon.inactiveOnly')}</option>
                    </select>
                </div>

                {loading ? (
                    <div className="p-6 text-center text-sm text-gray-500">جاري تحميل الكورسات...</div>
                ) : error ? (
                    <div className="p-6 text-center text-sm text-red-600">{error}</div>
                ) : (
                    <>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('courses.courseName')}</th>
                                        <th>{t('courses.category')}</th>
                                        <th>{t('courses.instructor')}</th>
                                        <th>الطلاب</th>
                                        <th>{t('courses.videos')}</th>
                                        <th>{t('courses.expiresAt')}</th>
                                        <th>{t('common.status')}</th>
                                        <th>{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {courses.map((course) => (
                                        <tr key={course.id}>
                                            <td className="font-medium">{course.title}</td>
                                            <td>{course.subject?.name}</td>
                                            <td>{course.instructor?.full_name}</td>
                                            <td>{course.enrollments_count ?? '-'}</td>
                                            <td>
                                                <div className="flex items-center gap-1">
                                                    <Video size={14} />
                                                    <span>{course.sections?.reduce((sum, s) => sum + (s.lessons?.length || 0), 0) ?? '-'}</span>
                                                </div>
                                            </td>
                                            <td className="text-gray-600 text-sm whitespace-nowrap">
                                                {course.expires_at
                                                    ? String(course.expires_at).slice(0, 10)
                                                    : '—'}
                                            </td>
                                            <td>
                                                <span className={`status-badge status-${course.status === 'published' ? 'active' : 'inactive'}`}>
                                                    {statusLabel(course.status)}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="table-actions">
                                                    <button
                                                        className="action-btn action-btn-view"
                                                        title={t('common.view')}
                                                        onClick={() => navigate(`/courses/${course.id}`)}
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="action-btn action-btn-edit"
                                                        title={t('common.edit')}
                                                        onClick={() => navigate(`/courses/${course.id}/edit`)}
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button className="action-btn action-btn-delete" title={t('common.delete')}>
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
                                    onClick={() => fetchCourses(pagination.current_page - 1)}
                                >
                                    {t('common.previous')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.current_page >= pagination.last_page}
                                    onClick={() => fetchCourses(pagination.current_page + 1)}
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

export default CoursesList;
