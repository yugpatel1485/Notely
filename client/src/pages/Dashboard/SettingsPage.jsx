import { useState }     from 'react';
import { useNavigate }  from 'react-router-dom';
import { useAuth }      from '../../context/AuthContext';
import authService      from '../../services/authService';
import DeleteAccountModal from './DeleteAccountModal';
import styles           from './SettingsPage.module.css';

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  const [form, setForm]     = useState({ username: user?.username || '', avatar: user?.avatar || '' });
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  function handleChange(e) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    if (status) setStatus(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await authService.updateProfile(form);
      updateUser(updated);
      setStatus({ type: 'success', message: 'Profile updated!' });
    } catch (err) {
      setStatus({ type: 'error', message: err.response?.data?.message || 'Update failed' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>Settings</h1>
      <p className={styles.pageSub}>Manage your account preferences</p>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Profile</h2>

        {status && (
          <div className={`${styles.banner} ${styles[`banner--${status.type}`]}`}>
            {status.message}
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.avatarRow}>
            <div className={styles.avatar}>
              {user?.avatar
                ? <img src={user.avatar} alt={user.username} />
                : <span>{user?.username?.[0]?.toUpperCase()}</span>
              }
            </div>
            <div className={styles.avatarMeta}>
              <span className={styles.avatarName}>{user?.username}</span>
              <span className={styles.avatarEmail}>{user?.email}</span>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Username</label>
            <input
              type="text"
              name="username"
              className={styles.input}
              value={form.username}
              onChange={handleChange}
              minLength={3}
              maxLength={30}
              required
            />
          </div>

          {/* Avatar URL field hidden until Phase 3 file upload is implemented
          <div className={styles.field}>
            <label className={styles.label}>Avatar URL</label>
            <input
              type="url"
              name="avatar"
              className={styles.input}
              placeholder="https://…"
              value={form.avatar}
              onChange={handleChange}
            />
            <span className={styles.hint}>Link to a public image (Phase 3 will add file upload)</span>
          </div>
          */}

          <button type="submit" className={styles.btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes →'}
          </button>
        </form>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Account info</h2>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Email:</span>
            <span className={styles.infoValue}>{user?.email}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Role:</span>
            <span className={styles.infoValue}>{user?.role}</span>
          </div>
          <div className={styles.infoItem}>
            <span className={styles.infoLabel}>Member since:</span>
            <span className={styles.infoValue}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
            </span>
          </div>
        </div>
      </div>
      <div className={styles.section}>
        <h2 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>Danger zone</h2>
        <p className={styles.dangerText}>
          Permanently delete your account. Notes you own will be deleted too —
          notes shared with you by others are unaffected.
        </p>
        <button
          type="button"
          className={styles.btnDanger}
          onClick={() => setShowDeleteModal(true)}
        >
          Delete account
        </button>
      </div>

      {showDeleteModal && (
        <DeleteAccountModal
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            logout();
            navigate('/login', { replace: true });
          }}
        />
      )}
    </div>
  );
}
