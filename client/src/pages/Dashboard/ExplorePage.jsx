import { useState, useEffect, useCallback } from 'react';
import notesService from '../../services/notesService';
import MarkdownPreview from '../../components/Notes/MarkdownPreview';
import { toPreviewText } from '../../utils/textPreview';
import styles       from './ExplorePage.module.css';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ExplorePage() {
  const [notes,      setNotes]      = useState([]);
  const [pagination, setPagination] = useState(null);
  const [search,     setSearch]     = useState('');
  const [tag,        setTag]        = useState('');
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [activeNote,   setActiveNote]   = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError,   setViewerError]   = useState('');

  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiSummary,   setAiSummary]   = useState('');
  const [aiLoading,   setAiLoading]   = useState(false);

  async function openNote(id) {
    setViewerError('');
    setViewerLoading(true);
    setActiveNote({}); // open the modal immediately with a loading state
    setShowAiPanel(false);
    setAiSummary('');
    try {
      const note = await notesService.getNoteById(id);
      setActiveNote(note);
      notesService.recordView(id);
    } catch (err) {
      setViewerError(err.response?.data?.message || 'Failed to load this note');
    } finally {
      setViewerLoading(false);
    }
  }

  function closeNote() {
    setActiveNote(null);
    setViewerError('');
    setShowAiPanel(false);
    setAiSummary('');
  }

  async function generateAiSummary() {
    if (!activeNote?._id) return;
    setAiLoading(true);
    setAiSummary('');
    try {
      const { default: api } = await import('../../services/api');
      const res = await api.post('/ai/summarise', { noteId: activeNote._id });
      setAiSummary(res.data.data.summary);
    } catch (err) {
      setAiSummary(err.response?.data?.message || 'AI summary failed — try again');
    } finally {
      setAiLoading(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page };
      if (search) params.search = search;
      if (tag)    params.tag    = tag;
      const data = await notesService.getPublicNotes(params);
      setNotes(data.notes);
      setPagination(data.pagination);
      setHasLoadedOnce(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load public notes');
    } finally {
      setLoading(false);
    }
  }, [page, search, tag]);

  useEffect(() => {
    const t = setTimeout(load, (search || tag) ? 450 : 0);
    return () => clearTimeout(t);
  }, [load, search, tag]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Explore</h1>
        <p className={styles.pageSub}>Publicly shared notes from the community</p>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search public notes…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <input
          className={styles.tagInput}
          type="text"
          placeholder="Filter by tag…"
          value={tag}
          onChange={(e) => { setTag(e.target.value); setPage(1); }}
        />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading && !hasLoadedOnce ? (
        <div className={styles.loadingGrid}>
          {[...Array(6)].map((_, i) => <div key={i} className={styles.skeleton} />)}
        </div>
      ) : notes.length === 0 ? (
        <div className={styles.empty}>
          <span>◎</span>
          <p>No public notes found</p>
        </div>
      ) : (
        <div className={`${styles.list} ${loading ? styles.listSearching : ''}`}>
          {notes.map((note) => (
            <article
              key={note._id}
              className={styles.item}
              role="button"
              tabIndex={0}
              onClick={() => openNote(note._id)}
              onKeyDown={(e) => e.key === 'Enter' && openNote(note._id)}
            >
              <div className={styles.itemHeader}>
                <div className={styles.ownerRow}>
                  <div className={styles.ownerAvatar}>
                    {note.owner?.avatar
                      ? <img src={note.owner.avatar} alt={note.owner.username} />
                      : <span>{note.owner?.username?.[0]?.toUpperCase()}</span>
                    }
                  </div>
                  <span className={styles.ownerName}>{note.owner?.username}</span>
                  <span className={styles.dot}>·</span>
                  <span className={styles.noteDate}>{formatDate(note.updatedAt)}</span>
                </div>
                <div className={styles.tagRow}>
                  {note.tags?.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className={`${styles.tag} ${t === tag ? styles.tagActive : ''}`}
                      onClick={(e) => { e.stopPropagation(); setTag(t === tag ? '' : t); }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <h3 className={styles.noteTitle}>{note.title}</h3>
              {note.content && (
                <p className={styles.notePreview}>
                  {toPreviewText(note.content, 200)}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={!pagination.hasPrev}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Prev
          </button>
          <span className={styles.pageInfo}>{pagination.page} / {pagination.totalPages}</span>
          <button
            className={styles.pageBtn}
            disabled={!pagination.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </button>
        </div>
      )}
      {activeNote && (
        <div className={styles.viewerBackdrop} onClick={(e) => e.target === e.currentTarget && closeNote()}>
          <div className={styles.viewerModal}>
            <div className={styles.viewerHeader}>
              {!viewerLoading && !viewerError && activeNote?._id ? (
                <button
                  className={`${styles.viewerAiBtn} ${showAiPanel ? styles.viewerAiBtnActive : ''}`}
                  onClick={() => setShowAiPanel((s) => !s)}
                  title="AI Summary"
                >
                  ✦ AI
                </button>
              ) : <span />}
              <button className={styles.viewerClose} onClick={closeNote} aria-label="Close">✕</button>
            </div>
            {viewerLoading ? (
              <p className={styles.viewerStatus}>Loading…</p>
            ) : viewerError ? (
              <p className={styles.viewerStatus}>{viewerError}</p>
            ) : (
              <>
                {showAiPanel && (
                  <div className={styles.aiPanel}>
                    <div className={styles.aiHeader}>
                      <span>✦ AI Summary</span>
                      <button className={styles.aiGenBtn} onClick={generateAiSummary} disabled={aiLoading}>
                        {aiLoading ? 'Generating…' : 'Generate'}
                      </button>
                    </div>
                    {aiSummary && <p className={styles.aiResult}>{aiSummary}</p>}
                  </div>
                )}
                <div className={styles.viewerOwnerRow}>
                  <div className={styles.ownerAvatar}>
                    {activeNote.owner?.avatar
                      ? <img src={activeNote.owner.avatar} alt={activeNote.owner.username} />
                      : <span>{activeNote.owner?.username?.[0]?.toUpperCase()}</span>
                    }
                  </div>
                  <span className={styles.ownerName}>{activeNote.owner?.username}</span>
                  <span className={styles.dot}>·</span>
                  <span className={styles.noteDate}>{formatDate(activeNote.updatedAt)}</span>
                </div>
                <h2 className={styles.viewerTitle}>{activeNote.title}</h2>
                {activeNote.tags?.length > 0 && (
                  <div className={styles.tagRow}>
                    {activeNote.tags.map((t) => <span key={t} className={styles.tag}>{t}</span>)}
                  </div>
                )}
                <div className={styles.viewerContent}>
                  {activeNote.content
                    ? <MarkdownPreview content={activeNote.content} />
                    : <p className={styles.viewerStatus}>No content yet…</p>
                  }
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
