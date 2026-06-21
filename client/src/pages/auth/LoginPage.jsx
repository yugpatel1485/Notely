import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Auth.module.css';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    const result = await login({ email: form.email, password: form.password });
    setLoading(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Header */}
        <div className={styles.header}>
          <Link to="/" className={styles.logo}>Notely</Link>
          <p className={styles.eyebrow}>Welcome back</p>
          <h1 className={styles.title}>
            Sign in to your<br /><em>workspace.</em>
          </h1>
        </div>

        {/* Error */}
        {error && (
          <div className={styles.errorBanner} role="alert">
            <span className={styles.errorIcon}>!</span>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              className={styles.input}
              disabled={loading}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              className={styles.input}
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? (
              <span className={styles.spinner} aria-label="Signing in…" />
            ) : (
              <span>Sign In →</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className={styles.footerText}>
          Don&apos;t have an account?{' '}
          <Link to="/register" className={styles.footerLink}>Create one →</Link>
        </p>
      </div>

      {/* Decorative background */}
      <div className={styles.bgDecor} aria-hidden="true">
        <span className={styles.bgWord}>NOTELY</span>
      </div>
    </div>
  );
}
