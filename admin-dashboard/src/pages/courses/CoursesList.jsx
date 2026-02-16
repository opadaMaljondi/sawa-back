import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Filter, Edit, Trash2, Eye, Video } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { coursesAPI } from '../../services/api';

const CoursesList = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [courses, setCourses] = useState([]);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchCourses = async (page = 1) => {
        try {
            setLoading(true);
            setError('');
            const res = await coursesAPI.getAll({ page });
            setCourses(res.data || []);
            setPagination({ current_page: res.current_page, last_page: res.last_page });
        } catch (e) {
            console.error(e);
            setError('فشل تحميل قائمة الكورسات');
            setCourses([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCourses(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                                            <td>
                                                <span className={`status-badge status-${course.status === 'published' ? 'active' : 'inactive'}`}>
                                                    {course.status === 'published' ? 'منشور' : 'مسودة'}
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
                                                    <button className="action-btn action-btn-edit" title={t('common.edit')}>
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
