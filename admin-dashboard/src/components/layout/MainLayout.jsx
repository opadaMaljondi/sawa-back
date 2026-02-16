import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import './MainLayout.css';

const MainLayout = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const toggleSidebar = () => {
        setSidebarCollapsed(!sidebarCollapsed);
    };

    return (
        <div className="main-layout">
            <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
            <div className={`main-layout-content ${sidebarCollapsed ? 'content-expanded' : ''}`}>
                <Header onMenuClick={toggleSidebar} />
                <main className="main-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MainLayout;
