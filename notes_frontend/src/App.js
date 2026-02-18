import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { createNote, deleteNote, listNotes, listTags, updateNote } from './api/client';
import { useDebouncedValue } from './hooks/useDebouncedValue';

const AUTOSAVE_DELAY_MS = 700;

// PUBLIC_INTERFACE
function App() {
  const [theme, setTheme] = useState('light');

  const [notes, setNotes] = useState([]);
  const [tags, setTags] = useState([]);

  const [activeNoteId, setActiveNoteId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebouncedValue(searchQuery, 300);

  const [selectedTag, setSelectedTag] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorTags, setEditorTags] = useState('');
  const [editorPinned, setEditorPinned] = useState(false);
  const [editorFavorite, setEditorFavorite] = useState(false);

  const [dirty, setDirty] = useState(false);
  const lastSavedRef = useRef({ title: '', content: '', tags: '', pinned: false, favorite: false });

  // Theme handling
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    /** Toggle between light and dark theme. */
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const activeNote = useMemo(() => notes.find(n => n.id === activeNoteId) || null, [notes, activeNoteId]);

  const normalizedEditorTags = useMemo(() => {
    const parts = editorTags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    return Array.from(new Set(parts));
  }, [editorTags]);

  const refresh = async ({ keepSelection = true } = {}) => {
    setLoading(true);
    setError('');
    try {
      const [notesData, tagsData] = await Promise.all([
        listNotes({
          q: debouncedQuery || undefined,
          tags: selectedTag ? [selectedTag] : undefined
        }),
        listTags()
      ]);
      setNotes(notesData);
      setTags(tagsData);

      if (!keepSelection) {
        setActiveNoteId(null);
      } else if (activeNoteId !== null) {
        const stillExists = notesData.some(n => n.id === activeNoteId);
        if (!stillExists) setActiveNoteId(null);
      }
    } catch (e) {
      setError(e.message || 'Failed to load notes.');
    } finally {
      setLoading(false);
    }
  };

  // initial + on filters
  useEffect(() => {
    refresh({ keepSelection: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, selectedTag]);

  // Load selected note into editor
  useEffect(() => {
    if (!activeNote) {
      setEditorTitle('');
      setEditorContent('');
      setEditorTags('');
      setEditorPinned(false);
      setEditorFavorite(false);
      setDirty(false);
      lastSavedRef.current = { title: '', content: '', tags: '', pinned: false, favorite: false };
      return;
    }

    const tagStr = (activeNote.tags || []).join(', ');
    setEditorTitle(activeNote.title || '');
    setEditorContent(activeNote.content || '');
    setEditorTags(tagStr);
    setEditorPinned(Boolean(activeNote.is_pinned));
    setEditorFavorite(Boolean(activeNote.is_favorite));
    setDirty(false);
    lastSavedRef.current = {
      title: activeNote.title || '',
      content: activeNote.content || '',
      tags: tagStr,
      pinned: Boolean(activeNote.is_pinned),
      favorite: Boolean(activeNote.is_favorite)
    };
  }, [activeNoteId, activeNote]);

  // Autosave
  const debouncedDirty = useDebouncedValue(dirty, AUTOSAVE_DELAY_MS);

  useEffect(() => {
    const doSave = async () => {
      if (!activeNoteId) return;
      if (!debouncedDirty) return;

      const last = lastSavedRef.current;
      const hasChanges =
        last.title !== editorTitle ||
        last.content !== editorContent ||
        last.tags !== editorTags ||
        last.pinned !== editorPinned ||
        last.favorite !== editorFavorite;

      if (!hasChanges) {
        setDirty(false);
        return;
      }

      try {
        await updateNote(activeNoteId, {
          title: editorTitle,
          content: editorContent,
          tags: normalizedEditorTags,
          is_pinned: editorPinned,
          is_favorite: editorFavorite
        });
        lastSavedRef.current = {
          title: editorTitle,
          content: editorContent,
          tags: editorTags,
          pinned: editorPinned,
          favorite: editorFavorite
        };
        setDirty(false);
        refresh({ keepSelection: true });
      } catch (e) {
        setError(e.message || 'Autosave failed.');
      }
    };

    doSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDirty]);

  const onCreate = async () => {
    setError('');
    try {
      const created = await createNote({
        title: 'New Note',
        content: '',
        tags: selectedTag ? [selectedTag] : []
      });
      await refresh({ keepSelection: false });
      setActiveNoteId(created.id);
    } catch (e) {
      setError(e.message || 'Failed to create note.');
    }
  };

  const onDelete = async noteId => {
    if (!noteId) return;
    setError('');
    try {
      await deleteNote(noteId);
      await refresh({ keepSelection: false });
      setActiveNoteId(null);
    } catch (e) {
      setError(e.message || 'Failed to delete note.');
    }
  };

  const togglePinned = async noteId => {
    const n = notes.find(x => x.id === noteId);
    if (!n) return;
    setError('');
    try {
      await updateNote(noteId, { is_pinned: !n.is_pinned });
      refresh({ keepSelection: true });
    } catch (e) {
      setError(e.message || 'Failed to update pinned state.');
    }
  };

  const toggleFavorite = async noteId => {
    const n = notes.find(x => x.id === noteId);
    if (!n) return;
    setError('');
    try {
      await updateNote(noteId, { is_favorite: !n.is_favorite });
      refresh({ keepSelection: true });
    } catch (e) {
      setError(e.message || 'Failed to update favorite state.');
    }
  };

  const onSelectTag = name => {
    setSelectedTag(prev => (prev === name ? '' : name));
  };

  const onEditorChange = setter => e => {
    setter(e.target.value);
    setDirty(true);
  };

  return (
    <div className="App notes-app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-badge">NM</div>
          <div className="brand-text">
            <div className="brand-title">Notemaster</div>
            <div className="brand-subtitle">retro notes • autosave • tags</div>
          </div>
        </div>

        <div className="topbar-controls">
          <label className="search" aria-label="Search notes">
            <span className="search-label">Search</span>
            <input
              className="input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="title or content…"
            />
          </label>

          <button className="btn theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>

          <button className="btn btn-primary" onClick={onCreate}>
            + New
          </button>
        </div>
      </header>

      <main className="layout">
        <aside className="sidebar" aria-label="Tags sidebar">
          <div className="panel-header">
            <div className="panel-title">Tags</div>
            <div className="panel-meta">{tags.length}</div>
          </div>

          <button
            className={`chip ${selectedTag === '' ? 'chip-active' : ''}`}
            onClick={() => setSelectedTag('')}
          >
            All
          </button>

          <div className="chips">
            {tags.map(t => (
              <button
                key={t.name}
                className={`chip ${selectedTag === t.name ? 'chip-active' : ''}`}
                onClick={() => onSelectTag(t.name)}
                title={`${t.note_count} note(s)`}
              >
                {t.name}
                <span className="chip-count">{t.note_count}</span>
              </button>
            ))}
          </div>

          <div className="hint">
            Tip: select a tag to filter. Create a new note while filtered to auto-apply that tag.
          </div>
        </aside>

        <section className="list" aria-label="Notes list">
          <div className="panel-header">
            <div className="panel-title">Notes</div>
            <div className="panel-meta">{loading ? '…' : notes.length}</div>
          </div>

          {error ? <div className="error" role="alert">{error}</div> : null}

          <div className="note-items">
            {notes.map(n => (
              <button
                key={n.id}
                className={`note-item ${activeNoteId === n.id ? 'note-item-active' : ''}`}
                onClick={() => setActiveNoteId(n.id)}
              >
                <div className="note-item-row">
                  <div className="note-title">{n.title || '(untitled)'}</div>
                  <div className="note-badges">
                    {n.is_pinned ? <span className="badge">PIN</span> : null}
                    {n.is_favorite ? <span className="badge badge-accent">FAV</span> : null}
                  </div>
                </div>
                <div className="note-preview">
                  {(() => {
                    // Compact preview snippet:
                    // - collapse whitespace/newlines from markdown body
                    // - keep dense layout by clamping to 2 lines in CSS
                    const raw = n.content || '';
                    const normalized = raw.replace(/\s+/g, ' ').trim();
                    return normalized.slice(0, 160) || 'No content yet.';
                  })()}
                </div>
                <div className="note-tags">
                  {(n.tags || []).slice(0, 3).map(t => (
                    <span key={t} className="tag-pill">
                      {t}
                    </span>
                  ))}
                  {(n.tags || []).length > 3 ? <span className="tag-pill">+{n.tags.length - 3}</span> : null}
                </div>
              </button>
            ))}

            {!loading && notes.length === 0 ? <div className="empty">No notes found.</div> : null}
          </div>
        </section>

        <section className="editor" aria-label="Note editor">
          <div className="panel-header">
            <div className="panel-title">Editor</div>
            <div className="panel-meta">{activeNoteId ? (dirty ? 'draft…' : 'saved') : '—'}</div>
          </div>

          {!activeNoteId ? (
            <div className="empty editor-empty">
              Select a note to edit, or create a new one.
            </div>
          ) : (
            <div className="editor-body">
              <label className="field">
                <span className="field-label">Title</span>
                <input className="input" value={editorTitle} onChange={onEditorChange(setEditorTitle)} />
              </label>

              <label className="field">
                <span className="field-label">Tags (comma-separated)</span>
                <input className="input" value={editorTags} onChange={onEditorChange(setEditorTags)} />
              </label>

              <label className="field">
                <span className="field-label">Markdown</span>
                <textarea
                  className="textarea"
                  value={editorContent}
                  onChange={onEditorChange(setEditorContent)}
                  placeholder="Write in markdown…"
                />
              </label>

              <div className="editor-actions">
                <button className="btn" onClick={() => togglePinned(activeNoteId)}>
                  {editorPinned ? 'Unpin' : 'Pin'}
                </button>
                <button className="btn" onClick={() => toggleFavorite(activeNoteId)}>
                  {editorFavorite ? 'Unfavorite' : 'Favorite'}
                </button>
                <button className="btn btn-danger" onClick={() => onDelete(activeNoteId)}>
                  Delete
                </button>
              </div>

              <div className="footer-note">
                Autosave after {AUTOSAVE_DELAY_MS}ms pause. Notes are sorted by pinned then last updated.
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
