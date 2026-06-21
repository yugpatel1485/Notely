import { useState, useEffect, useCallback } from 'react';
import { useNotes }    from '../../context/NotesContext';
import { useAuth }     from '../../context/AuthContext';
import NoteCard        from '../../components/Notes/NoteCard';
import NoteEditor      from '../../components/Notes/NoteEditor';
import styles          from './DashboardPage.module.css';

export default function DashboardPage() {
  const { user }                     = useAuth();
  const { notes, pagination, isLoading, error, fetchNotes, deleteNote, clearError } = useNotes();

  const [search,      setSearch]     = useState('');
  const [filterTag,   setFilterTag]  = useState('');
  const [filterVis,   setFilterVis]  = useState('');   // '' | 'true' | 'false'
  const [sort,        setSort]       = useState('pinned');
  const [page,        setPage]       = useState(1);
  const [editorNote,  setEditorNote] = useState(null);  // null = closed, {} = new, note = edit
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Debounced fetch
  const load = useCallback(() => {
    const params = { page, sort };
    if (search)   params.search   = search;
    if (filterTag)  params.tag    = filterTag;
    if (filterVis !== '') params.isPublic = filterVis;
    fetchNotes(params);
  }, [page, sort, search, filterTag, filterVis, fetchNotes]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // Collect all unique tags from current notes for the filter dropdown
  const allTags = [...new Set(notes.flatMap((n) => n.tags || []))].sort();

  async function handleDelete(id) {
    setConfirmDelete(id);
  }

  async function confirmDeleteNote() {
    if (!confirmDelete) return;
    await deleteNote(confirmDelete);
    setConfirmDelete(null);
  }

  function openNewEditor()  { setEditorNote({});   }
  function openEditEditor(n){ setEditorNote(n);    }
  function closeEditor()    { setEditorNote(null); load(); }

  return (
    <div className={styles.page}>
      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>My Notes</h1>
          <p className={styles.pageSubtitle}>
            {pagination?.total ?? 0} note{pagination?.total !== 1 ? 's' : ''}
            {user?.username ? ` · ${user.username}` : ''}
          </p>
        </div>
        <button className={styles.newBtn} onClick={openNewEditor}>
          + New note
        </button>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search notes…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />

        <select
          className={styles.select}
          value={filterTag}
          onChange={(e) => { setFilterTag(e.target.value); setPage(1); }}
        >
          <option value="">All tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          className={styles.select}
          value={filterVis}
          onChange={(e) => { setFilterVis(e.target.value); setPage(1); }}
        >
          <option value="">All visibility</option>
          <option value="false">Private</option>
          <option value="true">Public</option>
        </select>

        <select
          className={styles.select}
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="pinned">Pinned first</option>
          <option value="updatedAt">Newest</option>
          <option value="-updatedAt">Oldest</option>
          <option value="title">Title A–Z</option>
          <option value="-title">Title Z–A</option>
        </select>
      </div>

      {/* ── Error ───────────────────────────────────────────────────── */}
      {error && (
        <div className={styles.errorBanner}>
          {error}
          <button onClick={clearError} className={styles.errorClose}>✕</button>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className={styles.loadingGrid}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>◎</span>
          <p className={styles.emptyTitle}>No notes yet</p>
          <p className={styles.emptyBody}>
            {search || filterTag || filterVis
              ? 'Try adjusting your filters'
              : 'Create your first note to get started'}
          </p>
          {!search && !filterTag && !filterVis && (
            <button className={styles.emptyBtn} onClick={openNewEditor}>
              + New note
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {notes.map((note) => (
            <NoteCard
              key={note._id}
              note={note}
              onClick={openEditEditor}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────── */}
      {pagination && pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={!pagination.hasPrev}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span className={styles.pageInfo}>
            {pagination.page} / {pagination.totalPages}
          </span>
          <button
            className={styles.pageBtn}
            disabled={!pagination.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Note editor modal ────────────────────────────────────────── */}
      {editorNote !== null && (
        <NoteEditor
          note={editorNote._id ? editorNote : null}
          onClose={closeEditor}
        />
      )}

      {/* ── Delete confirmation ──────────────────────────────────────── */}
      {confirmDelete && (
        <div className={styles.confirmBackdrop}>
          <div className={styles.confirmDialog}>
            <p className={styles.confirmText}>Delete this note? This cannot be undone.</p>
            <div className={styles.confirmActions}>
              <button className={styles.btnGhost} onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className={styles.btnDanger} onClick={confirmDeleteNote}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
