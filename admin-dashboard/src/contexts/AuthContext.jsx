import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is logged in (from localStorage or API)
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                setIsAuthenticated(true);
            } catch (error) {
                console.error('Error parsing stored user:', error);
            }
        }
        setLoading(false);
    }, []);

    const login = async (loginIdentifier, password) => {
      try {
        // استدعاء API تسجيل الدخول في Laravel (email أو phone في حقل login)
        const res = await authAPI.login({ login: loginIdentifier, password });

        // نتوقع { user, token }
        const loggedUser = res.user;
        const token = res.token;

        // تأكيد أن المستخدم أدمن
        if (loggedUser?.type !== 'admin') {
          return { success: false, error: 'هذا الحساب ليس أدمن.' };
        }

        setUser(loggedUser);
        setIsAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(loggedUser));
        localStorage.setItem('token', token);

        return { success: true };
      } catch (error) {
        console.error('Login error:', error);
        const message = error.response?.data?.message || error.message || 'فشل تسجيل الدخول';
        return { success: false, error: message };
      }
    };

    const logout = async () => {
      try {
        await authAPI.logout();
      } catch (e) {
        // تجاهل أخطاء الـ logout
      }
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    };

    const updateUser = (userData) => {
        const updatedUser = { ...user, ...userData };
        setUser(updatedUser);
        localStorage.setItem('user', JSON.stringify(updatedUser));
    };

    const value = {
        user,
        isAuthenticated,
        loading,
        login,
        logout,
        updateUser
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
