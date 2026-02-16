import React, { createContext, useContext, useState, useEffect } from 'react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from '../locales/ar.json';
import en from '../locales/en.json';

// Initialize i18next
i18n
    .use(initReactI18next)
    .init({
        resources: {
            ar: { translation: ar },
            en: { translation: en }
        },
        lng: localStorage.getItem('language') || 'ar',
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        }
    });

const LanguageContext = createContext();

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return context;
};

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState(localStorage.getItem('language') || 'ar');
    const [direction, setDirection] = useState(language === 'ar' ? 'rtl' : 'ltr');

    useEffect(() => {
        // Update document direction and language
        document.documentElement.dir = direction;
        document.documentElement.lang = language;

        // Save to localStorage
        localStorage.setItem('language', language);

        // Change i18n language
        i18n.changeLanguage(language);
    }, [language, direction]);

    const toggleLanguage = () => {
        const newLang = language === 'ar' ? 'en' : 'ar';
        const newDir = newLang === 'ar' ? 'rtl' : 'ltr';
        setLanguage(newLang);
        setDirection(newDir);
    };

    const changeLanguage = (lang) => {
        const newDir = lang === 'ar' ? 'rtl' : 'ltr';
        setLanguage(lang);
        setDirection(newDir);
    };

    const value = {
        language,
        direction,
        toggleLanguage,
        changeLanguage,
        isRTL: direction === 'rtl'
    };

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
};

export default LanguageContext;
