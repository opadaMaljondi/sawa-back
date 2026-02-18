import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Plus,
    Edit2,
    Trash2,
    Shield,
    ShieldCheck,
    Check,
    AlertCircle,
    Layout,
    Users,
    Video,
    FileText,
    HelpCircle,
    MessageSquare,
    Settings as SettingsIcon,
    BarChart
} from 'lucide-react';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import { permissionsAPI } from '../../services/api';
import './RolesAndPermissions.css';

const RolesAndPermissions = () => {
    const { t } = useTranslation();
    const [roles, setRoles] = useState([]);
    const [allPermissions, setAllPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Role Modal State
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [editingRole, setEditingRole] = useState(null);
    const [roleName, setRoleName] = useState('');
    const [submittingRole, setSubmittingRole] = useState(false);

    // Permission Modal State
    const [showPermModal, setShowPermModal] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);
    const [selectedPermissions, setSelectedPermissions] = useState([]);
    const [submittingPerms, setSubmittingPerms] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [rolesRes, permsRes] = await Promise.all([
                permissionsAPI.getRoles(),
                permissionsAPI.getPermissions()
            ]);
            setRoles(rolesRes || []);
            setAllPermissions(permsRes || []);
            setError('');
        } catch (err) {
            console.error('Error fetching data:', err);
            setError(t('permissions.fetchError') || 'فشل تحميل البيانات');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenRoleModal = (role = null) => {
        if (role) {
            setEditingRole(role);
            setRoleName(role.name);
        } else {
            setEditingRole(null);
            setRoleName('');
        }
        setShowRoleModal(true);
    };

    const handleSaveRole = async (e) => {
        e.preventDefault();
        try {
            setSubmittingRole(true);
            if (editingRole) {
                await permissionsAPI.updateRole(editingRole.id, { name: roleName });
            } else {
                await permissionsAPI.createRole({ name: roleName });
            }
            setShowRoleModal(false);
            fetchData();
        } catch (err) {
            console.error('Error saving role:', err);
            alert(t('messages.error'));
        } finally {
            setSubmittingRole(false);
        }
    };

    const handleDeleteRole = async (role) => {
        if (['admin', 'instructor', 'student'].includes(role.name)) {
            alert(t('permissions.cannotDeleteSystemRole') || 'لا يمكن حذف الأدوار الأساسية للنظام');
            return;
        }

        if (window.confirm(t('messages.confirmDelete'))) {
            try {
                await permissionsAPI.deleteRole(role.id);
                fetchData();
            } catch (err) {
                console.error('Error deleting role:', err);
                alert(t('messages.error'));
            }
        }
    };

    const handleOpenPermModal = (role) => {
        setSelectedRole(role);
        setSelectedPermissions(role.permissions.map(p => p.name));
        setShowPermModal(true);
    };

    const togglePermission = (permName) => {
        setSelectedPermissions(prev =>
            prev.includes(permName)
                ? prev.filter(p => p !== permName)
                : [...prev, permName]
        );
    };

    const handleSavePermissions = async () => {
        try {
            setSubmittingPerms(true);
            await permissionsAPI.syncPermissions(selectedRole.id, selectedPermissions);
            setShowPermModal(false);
            fetchData();
        } catch (err) {
            console.error('Error saving permissions:', err);
            alert(t('messages.error'));
        } finally {
            setSubmittingPerms(false);
        }
    };

    const groupPermissions = () => {
        const groups = {
            'academic': { icon: <Shield size={18} />, permissions: [] },
            'content': { icon: <Video size={18} />, permissions: [] },
            'users': { icon: <Users size={18} />, permissions: [] },
            'other': { icon: <Layout size={18} />, permissions: [] }
        };

        allPermissions.forEach(perm => {
            if (perm.name.includes('video') || perm.name.includes('note') || perm.name.includes('exam') || perm.name.includes('course') || perm.name.includes('section')) {
                groups.content.permissions.push(perm);
            } else if (perm.name.includes('student') || perm.name.includes('instructor')) {
                groups.users.permissions.push(perm);
            } else if (perm.name.includes('department') || perm.name.includes('year') || perm.name.includes('semester') || perm.name.includes('subject')) {
                groups.academic.permissions.push(perm);
            } else {
                groups.other.permissions.push(perm);
            }
        });

        return groups;
    };

    const permissionGroups = groupPermissions();

    if (loading) return <div className="p-8 text-center">{t('common.loading')}</div>;

    return (
        <div className="permissions-page">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('nav.permissions')}</h1>
                    <p className="page-subtitle">{t('permissions.subtitle') || 'إدارة صلاحيات الوصول للأدوار المختلفة في النظام'}</p>
                </div>
                <Button
                    variant="primary"
                    icon={<Plus size={20} />}
                    onClick={() => handleOpenRoleModal()}
                >
                    {t('permissions.addRole') || 'إضافة دور جديد'}
                </Button>
            </div>

            <div className="roles-grid">
                {roles.map(role => (
                    <Card key={role.id} className="role-card">
                        <div className="role-card-header">
                            <div className="role-icon-wrapper">
                                <ShieldCheck size={24} className="role-icon" />
                            </div>
                            <div>
                                <h3 className="role-name">{role.name}</h3>
                                <span className="perms-count">
                                    {role.permissions?.length || 0} {t('permissions.perms') || 'صلاحية'}
                                </span>
                            </div>
                        </div>

                        <div className="role-card-body">
                            <div className="perms-preview">
                                {role.permissions?.slice(0, 3).map(p => (
                                    <span key={p.id} className="perm-tag">{p.name}</span>
                                ))}
                                {role.permissions?.length > 3 && (
                                    <span className="perm-tag more">+{role.permissions.length - 3}</span>
                                )}
                            </div>
                        </div>

                        <div className="role-card-footer">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenPermModal(role)}
                            >
                                {t('permissions.managePerms') || 'إدارة الصلاحيات'}
                            </Button>
                            <div className="role-actions">
                                <button className="action-btn edit" onClick={() => handleOpenRoleModal(role)}>
                                    <Edit2 size={16} />
                                </button>
                                {!['admin', 'instructor', 'student'].includes(role.name) && (
                                    <button className="action-btn delete" onClick={() => handleDeleteRole(role)}>
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Role Name Modal */}
            <Modal
                isOpen={showRoleModal}
                onClose={() => setShowRoleModal(false)}
                title={editingRole ? (t('permissions.editRole') || 'تعديل الدور') : (t('permissions.addRole') || 'إضافة دور')}
                size="sm"
            >
                <form onSubmit={handleSaveRole} className="space-y-4">
                    <Input
                        label={t('permissions.roleName') || 'اسم الدور'}
                        value={roleName}
                        onChange={(e) => setRoleName(e.target.value)}
                        placeholder="مثال: مشرف مالي، مراقب محتوى..."
                        required
                    />
                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="outline" onClick={() => setShowRoleModal(false)} type="button">
                            {t('common.cancel')}
                        </Button>
                        <Button variant="primary" type="submit" loading={submittingRole}>
                            {t('common.save')}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Permissions Assignment Modal */}
            <Modal
                isOpen={showPermModal}
                onClose={() => setShowPermModal(false)}
                title={`${t('permissions.managePerms')} - ${selectedRole?.name}`}
                size="lg"
            >
                <div className="permissions-selector">
                    {Object.keys(permissionGroups).map(groupKey => {
                        const group = permissionGroups[groupKey];
                        if (group.permissions.length === 0) return null;

                        return (
                            <div key={groupKey} className="perm-group">
                                <h4 className="group-title">
                                    {group.icon}
                                    {t(`permissions.groups.${groupKey}`) || groupKey}
                                </h4>
                                <div className="perms-list">
                                    {group.permissions.map(perm => (
                                        <label key={perm.id} className="perm-item">
                                            <div className="checkbox-wrapper">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPermissions.includes(perm.name)}
                                                    onChange={() => togglePermission(perm.name)}
                                                />
                                                <span className="checkmark"><Check size={12} /></span>
                                            </div>
                                            <span className="perm-name">{perm.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-100 dark:border-gray-800">
                    <Button variant="outline" onClick={() => setShowPermModal(false)}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={handleSavePermissions} loading={submittingPerms}>
                        {t('common.save')}
                    </Button>
                </div>
            </Modal>
        </div>
    );
};

export default RolesAndPermissions;
