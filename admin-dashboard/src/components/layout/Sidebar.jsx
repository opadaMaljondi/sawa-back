import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    LayoutDashboard,
    Users,
    GraduationCap,
    BookOpen,
    Shield,
    CreditCard,
    Building2,
    Calendar,
    BookMarked,
    Settings,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ collapsed, onToggle }) => {
    const { t } = useTranslation();

    const menuItems = [
        { path: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
        { path: '/students', icon: Users, label: t('nav.students') },
        { path: '/teachers', icon: GraduationCap, label: t('nav.teachers') },
        { path: '/courses', icon: BookOpen, label: t('nav.courses') },
        { path: '/permissions', icon: Shield, label: t('nav.permissions') },
        { path: '/subscriptions', icon: CreditCard, label: t('nav.subscriptions') },
        {
            label: t('nav.academic'),
            icon: Building2,
            children: [
                { path: '/academic/departments', icon: Building2, label: t('nav.departments') },
                { path: '/academic/years', icon: Calendar, label: t('nav.years') },
                { path: '/academic/semesters', icon: Calendar, label: t('nav.semesters') },
                { path: '/academic/subjects', icon: BookMarked, label: t('nav.subjects') }
            ]
        },
        { path: '/settings', icon: Settings, label: t('nav.settings') }
    ];

    const [expandedItems, setExpandedItems] = useState({});

    const toggleExpand = (label) => {
        setExpandedItems(prev => ({
            ...prev,
            [label]: !prev[label]
        }));
    };

    return (
        <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <div className="logo-icon">
                        <GraduationCap size={28} />
                    </div>
                    {!collapsed && <span className="logo-text">{t('common.appName')}</span>}
                </div>
            </div>

            <nav className="sidebar-nav">
                {menuItems.map((item, index) => {
                    if (item.children) {
                        const isExpanded = expandedItems[item.label];
                        return (
                            <div key={index} className="sidebar-group">
                                <button
                                    className="sidebar-group-header"
                                    onClick={() => toggleExpand(item.label)}
                                >
                                    <div className="sidebar-item-content">
                                        <item.icon size={20} />
                                        {!collapsed && <span>{item.label}</span>}
                                    </div>
                                    {!collapsed && (
                                        <ChevronRight
                                            size={16}
                                            className={`sidebar-chevron ${isExpanded ? 'sidebar-chevron-expanded' : ''}`}
                                        />
                                    )}
                                </button>
                                {!collapsed && isExpanded && (
                                    <div className="sidebar-submenu">
                                        {item.children.map((child, childIndex) => (
                                            <NavLink
                                                key={childIndex}
                                                to={child.path}
                                                className={({ isActive }) =>
                                                    `sidebar-link sidebar-sublink ${isActive ? 'sidebar-link-active' : ''}`
                                                }
                                            >
                                                <child.icon size={18} />
                                                <span>{child.label}</span>
                                            </NavLink>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    return (
                        <NavLink
                            key={index}
                            to={item.path}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
                            }
                        >
                            <item.icon size={20} />
                            {!collapsed && <span>{item.label}</span>}
                        </NavLink>
                    );
                })}
            </nav>

            <button className="sidebar-toggle" onClick={onToggle}>
                {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
        </aside>
    );
};

export default Sidebar;
