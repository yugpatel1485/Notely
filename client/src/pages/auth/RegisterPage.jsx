import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from './Auth.module.css';

const validate = ({ username, email, password, confirm }) => {
  if (!username || !email || !password || !confirm) return 'Please fill in all fields';
  if (username.length < 3)                           return 'Username must be at least 3 characters';
  if (!/^[a-zA-Z0-9_]+$/.test(username))            return 'Username: letters, numbers and underscores only';
  if (!/^\S+@\S+\.\S+$/.test(email))                return 'Please enter a valid email';
  if (password.length < 8)                           return 'Password must be at least 8 characters';
  if (password !== confirm)                          return 'Passwords do not match';
  return null;
};

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate     = useNavigate();

  const [form, setForm]       = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate(form);
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    const result = await register({ username: form.username, email: form.email, password: form.password });
    setLoading(false);

    if (result.success) {
      navigate('/dashboard', { replace: true });
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
          <p className={styles.eyebrow}>Get started — it&apos;s free</p>
          <h1 className={styles.title}>
            Create your<br /><em>account.</em>
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
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="username" className={styles.label}>Username</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="your_handle"
                value={form.username}
                onChange={handleChange}
                className={styles.input}
                disabled={loading}
                required
              />
            </div>

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
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={handleChange}
                className={styles.input}
                disabled={loading}
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="confirm" className={styles.label}>Confirm Password</label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat password"
                value={form.confirm}
                onChange={handleChange}
                className={styles.input}
                disabled={loading}
                required
              />
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? (
              <span className={styles.spinner} aria-label="Creating account…" />
            ) : (
              <span>Create Account →</span>
            )}
          </button>
        </form>

        <p className={styles.footerText}>
          Already have an account?{' '}
          <Link to="/login" className={styles.footerLink}>Sign in →</Link>
        </p>
      </div>

      <div className={styles.bgDecor} aria-hidden="true">
        <span className={styles.bgWord}>NOTELY</span>
      </div>
    </div>
  );
}
