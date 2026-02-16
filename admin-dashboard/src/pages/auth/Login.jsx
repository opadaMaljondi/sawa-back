import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Mail } from 'lucide-react';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { useAuth } from '../../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [loginField, setLoginField] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(loginField, password);
    setLoading(false);
    if (!res.success) {
      setError(res.error || 'بيانات الدخول غير صحيحة');
      return;
    }
    navigate('/', { replace: true });
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card-header">
          <h1 className="login-title">
            {t('auth.login', 'تسجيل الدخول - لوحة التحكم')}
          </h1>
          <p className="login-subtitle">
            {t(
              'auth.signIn',
              'من فضلك أدخل البريد أو رقم الموبايل وكلمة المرور لحساب الأدمن',
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}

          <Input
            label={t('auth.email', 'البريد الإلكتروني أو رقم الموبايل')}
            type="text"
            value={loginField}
            onChange={(e) => setLoginField(e.target.value)}
            required
            icon={<Mail size={18} />}
            fullWidth
          />

          <Input
            label={t('auth.password', 'كلمة المرور')}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            icon={<Lock size={18} />}
            fullWidth
          />

          <Button
            type="submit"
            variant="primary"
            fullWidth
            loading={loading}
            className="login-submit"
          >
            {t('auth.signIn', 'تسجيل الدخول')}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;

