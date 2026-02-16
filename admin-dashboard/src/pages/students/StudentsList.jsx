import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Filter, Edit, Trash2, Eye } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { studentsAPI } from '../../services/api';
import './StudentsList.css';

const StudentsList = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [students, setStudents] = useState([]);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchStudents = async (page = 1) => {
        try {
            setLoading(true);
            setError('');
            const res = await studentsAPI.getAll({ page });
            setStudents(res.data || []);
            setPagination({ current_page: res.current_page, last_page: res.last_page });
        } catch (e) {
            console.error(e);
            setError('فشل تحميل قائمة الطلاب');
            setStudents([]);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleBan = async (studentId) => {
        try {
            await studentsAPI.toggleBan(studentId);
            await fetchStudents(pagination.current_page || 1);
        } catch (e) {
            console.error(e);
            alert('فشل تغيير حالة الطالب');
        }
    };

    const filteredStudents = useMemo(() => {
        if (!searchTerm) return students;
        const term = searchTerm.toLowerCase();
        return students.filter((s) => {
            const name = (s.full_name || s.name || '').toLowerCase();
            const email = (s.email || '').toLowerCase();
            const phone = (s.phone || '').toLowerCase();
            return (
                name.includes(term) ||
                email.includes(term) ||
                phone.includes(term)
            );
        });
    }, [students, searchTerm]);

    useEffect(() => {
        fetchStudents(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                                    {filteredStudents.map((student) => (
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
                                                        className="action-btn action-btn-delete"
                                                        title={student.active ? 'حظر الطالب' : 'إلغاء الحظر'}
                                                        onClick={() => handleToggleBan(student.id)}
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
