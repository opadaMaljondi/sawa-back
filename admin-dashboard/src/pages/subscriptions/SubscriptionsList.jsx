import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Filter, Eye, CheckCircle, XCircle, Book, Layers, FileText } from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { subscriptionsAPI } from '../../services/api';
import './SubscriptionsList.css';

const SubscriptionsList = () => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [enrollments, setEnrollments] = useState([]);
    const [pagination, setPagination] = useState({ current_page: 1, last_page: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchEnrollments = async (page = 1) => {
        try {
            setLoading(true);
            setError('');
            const res = await subscriptionsAPI.getAll({ page, search: searchTerm });
            setEnrollments(res.data || []);
            setPagination({ current_page: res.current_page, last_page: res.last_page });
        } catch (e) {
            console.error(e);
            setError('فشل تحميل قائمة التسجيلات');
            setEnrollments([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const delaySearch = setTimeout(() => {
            fetchEnrollments(1);
        }, 500);
        return () => clearTimeout(delaySearch);
    }, [searchTerm]);

    const getItemIcon = (type) => {
        switch (type) {
            case 'full_course': return <Book size={16} className="text-blue-500" />;
            case 'section': return <Layers size={16} className="text-orange-500" />;
            case 'lesson': return <FileText size={16} className="text-green-500" />;
            default: return null;
        }
    };

    const getItemName = (enrollment) => {
        if (enrollment.type === 'full_course') return enrollment.course?.title || enrollment.course?.name || '---';
        if (enrollment.type === 'section') return `${enrollment.section?.title || 'قسم'} (${enrollment.course?.title || enrollment.course?.name || ''})`;
        if (enrollment.type === 'lesson') return `${enrollment.lesson?.title || 'درس'} (${enrollment.course?.title || enrollment.course?.name || ''})`;
        return '---';
    };

    const handleToggleStatus = async (id) => {
        try {
            await subscriptionsAPI.toggleStatus(id);
            fetchEnrollments(pagination.current_page);
        } catch (e) {
            alert('فشل تحديث الحالة');
        }
    };

    return (
        <div className="subscriptions-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('subscriptions.title')}</h1>
                    <p className="page-subtitle">{t('subscriptions.subscriptionList')}</p>
                </div>
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
                    <div className="p-6 text-center text-sm text-gray-500">{t('common.loading')}</div>
                ) : error ? (
                    <div className="p-6 text-center text-sm text-red-600">{error}</div>
                ) : (
                    <>
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>{t('subscriptions.subscriber')}</th>
                                        <th>{t('common.type')}</th>
                                        <th>{t('courses.courseName')}</th>
                                        <th>{t('common.price')}</th>
                                        <th>{t('common.status')}</th>
                                        <th>{t('common.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {enrollments.length > 0 ? (
                                        enrollments.map((item) => (
                                            <tr key={item.id}>
                                                <td className="font-medium">{item.student?.full_name || '---'}</td>
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        {getItemIcon(item.type)}
                                                        <span className="text-xs">
                                                            {item.type === 'full_course' ? 'كورس كامل' : item.type === 'section' ? 'قسم' : 'درس'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>{getItemName(item)}</td>
                                                <td>{item.final_price}</td>
                                                <td>
                                                    <span className={`status-badge status-${item.active ? 'active' : 'inactive'}`}>
                                                        {item.active ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                                        {item.active ? t('common.active') : t('common.inactive')}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="table-actions">
                                                        <button
                                                            className={`action-btn ${item.active ? 'text-red-500' : 'text-green-500'}`}
                                                            title={item.active ? t('common.inactive') : t('common.active')}
                                                            onClick={() => handleToggleStatus(item.id)}
                                                        >
                                                            {item.active ? <XCircle size={16} /> : <CheckCircle size={16} />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="6" className="text-center py-8 text-gray-400">
                                                {t('messages.noData')}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {pagination.last_page > 1 && (
                            <div className="table-pagination">
                                <p className="pagination-info">
                                    صفحة {pagination.current_page} من {pagination.last_page}
                                </p>
                                <div className="pagination-controls">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={pagination.current_page <= 1}
                                        onClick={() => fetchEnrollments(pagination.current_page - 1)}
                                    >
                                        {t('common.previous')}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={pagination.current_page >= pagination.last_page}
                                        onClick={() => fetchEnrollments(pagination.current_page + 1)}
                                    >
                                        {t('common.next')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </Card>
        </div>
    );
};

export default SubscriptionsList;
