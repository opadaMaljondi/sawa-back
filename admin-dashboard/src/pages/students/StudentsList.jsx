import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Edit, Trash2, Eye, UserMinus } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { studentsAPI, academicAPI } from '../../services/api';
import './StudentsList.css';

const StudentsList = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchInput, setSearchInput] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [departmentId, setDepartmentId] = useState('');
    const [yearId, setYearId] = useState('');
    const [activeFilter, setActiveFilter] = useState('');
    const [departments, setDepartments] = useState([]);
    const [years, setYears] = useState([]);
    const [students, setStudents] = useState([]);
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
        const params = { per_page: 500 };
        if (departmentId) params.department_id = departmentId;
        academicAPI.getYears(params).then((res) => {
            setYears(res.data || []);
        }).catch(() => setYears([]));
    }, [departmentId]);

    const fetchStudents = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            setError('');
            const params = { page };
            if (debouncedSearch) params.search = debouncedSearch;
            if (departmentId) params.department_id = departmentId;
            if (yearId) params.year_id = yearId;
            if (activeFilter === 'active') params.active = true;
            else if (activeFilter === 'inactive') params.active = false;
            const res = await studentsAPI.getAll(params);
            setStudents(res.data || []);
            setPagination({ current_page: res.current_page, last_page: res.last_page });
        } catch (e) {
            console.error(e);
            setError('فشل تحميل قائمة الطلاب');
            setStudents([]);
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, departmentId, yearId, activeFilter]);

    useEffect(() => {
        fetchStudents(1);
    }, [fetchStudents]);

    const handleToggleBan = async (studentId) => {
        try {
            await studentsAPI.toggleBan(studentId);
            await fetchStudents(pagination.current_page || 1);
        } catch (e) {
            console.error(e);
            alert('فشل تغيير حالة الطالب');
        }
    };

    const handleDelete = async (studentId) => {
        if (!window.confirm(t('messages.confirmDelete'))) return;
        try {
            await studentsAPI.delete(studentId);
            await fetchStudents(pagination.current_page || 1);
        } catch (e) {
            console.error(e);
            alert(e.response?.data?.message || 'فشل حذف الطالب');
        }
    };

    return (
        <div className="students-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('students.title')}</h1>
                    <p className="page-subtitle">{t('students.studentList')}</p>
                </div>
                <Button
                    variant="primary"
                    icon={<Plus size={18} />}
                    onClick={() => navigate('/students/new')}
                >
                    {t('students.addStudent')}
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
                            setYearId('');
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
                        value={yearId}
                        onChange={(e) => setYearId(e.target.value)}
                        aria-label={t('nav.years')}
                    >
                        <option value="">{t('nav.years')}: {t('common.all')}</option>
                        {years.map((y) => (
                            <option key={y.id} value={y.id}>{y.name}</option>
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
                    <div className="p-6 text-center text-sm text-gray-500">جاري تحميل الطلاب...</div>
                ) : error ? (
                    <div className="p-6 text-center text-sm text-red-600">{error}</div>
                ) : (
                    <>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('students.firstName')}</th>
                                        <th>{t('students.email')}</th>
                                        <th>{t('students.phone')}</th>
                                        <th>{t('common.status')}</th>
                                        <th>{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map((student) => (
                                        <tr key={student.id}>
                                            <td className="font-medium">{student.full_name || student.name}</td>
                                            <td>{student.email}</td>
                                            <td>{student.phone}</td>
                                            <td>
                                                <span className={`status-badge status-${student.active ? 'active' : 'inactive'}`}>
                                                    {student.active ? t('common.active') : t('common.inactive')}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="table-actions">
                                                    <button
                                                        className="action-btn action-btn-view"
                                                        title={t('common.view')}
                                                        onClick={() => navigate(`/students/${student.id}`)}
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                    <button
                                                        className="action-btn action-btn-edit"
                                                        title={t('common.edit')}
                                                        onClick={() => navigate(`/students/${student.id}/edit`)}
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        className="action-btn action-btn-edit"
                                                        title={student.active ? 'حظر الطالب' : 'إلغاء الحظر'}
                                                        style={{ color: student.active ? 'var(--color-warning-600)' : 'var(--color-success-600)' }}
                                                        onClick={() => handleToggleBan(student.id)}
                                                    >
                                                        <UserMinus size={16} />
                                                    </button>
                                                    <button
                                                        className="action-btn action-btn-delete"
                                                        title={t('common.delete')}
                                                        onClick={() => handleDelete(student.id)}
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
                                    onClick={() => fetchStudents(pagination.current_page - 1)}
                                >
                                    {t('common.previous')}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={pagination.current_page >= pagination.last_page}
                                    onClick={() => fetchStudents(pagination.current_page + 1)}
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

export default StudentsList;
