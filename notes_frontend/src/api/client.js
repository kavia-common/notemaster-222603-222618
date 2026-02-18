/**
 * Minimal API client for notes_backend.
 *
 * Env var (CRA):
 * - REACT_APP_API_BASE_URL (e.g. "http://localhost:3001")
 */

const DEFAULT_BASE_URL = '';

function getBaseUrl() {
  return (process.env.REACT_APP_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

async function request(path, options = {}) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (res.status === 204) {
    return null;
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = data && data.detail ? data.detail : `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return data;
}

// PUBLIC_INTERFACE
export async function listNotes({ q, tags, pinned, favorite } = {}) {
  /** List/search notes. */
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (pinned !== undefined && pinned !== null) params.set('pinned', String(pinned));
  if (favorite !== undefined && favorite !== null) params.set('favorite', String(favorite));
  if (tags && tags.length) {
    tags.forEach(t => params.append('tags', t));
  }

  const qs = params.toString() ? `?${params.toString()}` : '';
  return request(`/notes${qs}`, { method: 'GET' });
}

// PUBLIC_INTERFACE
export async function getNote(noteId) {
  /** Get a note by id. */
  return request(`/notes/${noteId}`, { method: 'GET' });
}

// PUBLIC_INTERFACE
export async function createNote(payload) {
  /** Create a new note. */
  return request('/notes', { method: 'POST', body: JSON.stringify(payload) });
}

// PUBLIC_INTERFACE
export async function updateNote(noteId, payload) {
  /** Update an existing note. */
  return request(`/notes/${noteId}`, { method: 'PUT', body: JSON.stringify(payload) });
}

// PUBLIC_INTERFACE
export async function deleteNote(noteId) {
  /** Delete a note by id. */
  return request(`/notes/${noteId}`, { method: 'DELETE' });
}

// PUBLIC_INTERFACE
export async function listTags() {
  /** List all tags. */
  return request('/tags', { method: 'GET' });
}
