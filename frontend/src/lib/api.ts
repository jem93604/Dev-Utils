import axios from 'axios';

export const api = axios.create({ baseURL: '/api/v1' });

/* ---- Auth token store (localStorage; moves to httpOnly cookies if XSS becomes a concern) ---- */
const TOKEN_KEY = 'sqlhub_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // Expired/revoked credentials: drop the token and bounce to login.
    // Guard the login page itself to avoid a redirect loop.
    if (err?.response?.status === 401 && getToken() && !window.location.hash.startsWith('#/login')) {
      setToken(null);
      window.location.hash = '#/login';
    }
    return Promise.reject(err);
  },
);

export interface Section {
  id: string; name: string; slug: string; color: string;
  description: string; inputs: string[]; query_count: number;
}
export interface Query {
  id: string; section_id: string; title: string; purpose: string;
  steps: string; sql_text: string; variables: string[]; pinned: boolean;
}
export interface InputDef { key: string; label: string; placeholder: string }
export interface Note {
  id: string; title: string; content: string;
  sort_order?: number; created_at?: string; updated_at?: string;
}
export interface ScriptItem {
  id: string; file_name: string; path: string; remark: string;
  purpose: string; steps: string;
}
export interface Version { id: string; remark: string; created_at?: string }

export interface Stats { sections: number; queries: number; pinned: number; notes: number; scripts: number }

export async function getStats(): Promise<Stats> {
  const r = await api.get('/stats');
  return r.data;
}

export async function getSections(): Promise<Section[]> {
  const r = await api.get('/sections');
  return r.data;
}
export async function getQueries(sectionId: string): Promise<Query[]> {
  const r = await api.get(`/sections/${sectionId}/queries`);
  return r.data;
}
export async function getPins(): Promise<Query[]> {
  const r = await api.get('/pins');
  return r.data;
}
export async function togglePinRemote(queryId: string, pinned: boolean) {
  if (pinned) await api.delete(`/pins/${queryId}`);
  else await api.put(`/pins/${queryId}`);
}

/* ---- Queries ---- */
export interface QueryPayload {
  section_id: string; title: string;
  purpose?: string; steps?: string; sql_text: string;
}
export async function createQuery(payload: QueryPayload): Promise<Query> {
  const r = await api.post('/queries', payload);
  return r.data;
}
export async function updateQuery(id: string, payload: Partial<QueryPayload>): Promise<Query> {
  const r = await api.patch(`/queries/${id}`, payload);
  return r.data;
}
export async function deleteQuery(id: string) {
  await api.delete(`/queries/${id}`);
}

/* ---- Sections ---- */
export interface SectionPayload { name: string; color?: string; description?: string }
export async function createSection(payload: SectionPayload): Promise<Section> {
  const r = await api.post('/sections', payload);
  return r.data;
}
export async function deleteSection(id: string) {
  await api.delete(`/sections/${id}`);
}

/* ---- Search ---- */
export interface SearchResults {
  sections: { id: string; name: string; slug: string }[];
  queries: Query[];
  notes: Note[];
}
export async function searchApi(q: string): Promise<SearchResults> {
  const r = await api.get('/search', { params: { q } });
  return r.data;
}

/* ---- Versions ---- */
export async function getVersions(): Promise<Version[]> {
  const r = await api.get('/versions');
  return r.data;
}
export async function createVersion(remark: string): Promise<Version> {
  const r = await api.post('/versions', { remark });
  return r.data;
}
export async function restoreVersion(id: string) {
  const r = await api.post(`/versions/${id}/restore`);
  return r.data;
}

/* ---- Auth ---- */
export interface AuthUser {
  id: string; email: string; display_name: string;
  is_active: boolean; is_admin: boolean; created_at?: string;
}

export interface AuthStatus {
  auth_enabled: boolean; allow_signup: boolean;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const r = await api.get('/auth/status');
  return r.data;
}

export async function register(payload: { email: string; password: string; display_name?: string }): Promise<{ access_token: string; user: AuthUser }> {
  const r = await api.post('/auth/register', payload);
  return r.data;
}

export async function login(payload: { email: string; password: string }): Promise<{ access_token: string; user: AuthUser }> {
  const r = await api.post('/auth/login', payload);
  return r.data;
}

export async function fetchMe(): Promise<AuthUser> {
  const r = await api.get('/auth/me');
  return r.data;
}

export async function listUsers(): Promise<AuthUser[]> {
  const r = await api.get('/auth/users');
  return r.data;
}

export async function updateUser(id: string, payload: { is_active?: boolean; display_name?: string }): Promise<AuthUser> {
  const r = await api.patch(`/auth/users/${id}`, payload);
  return r.data;
}

/* ---- Notes ---- */
export type NoteSort = 'created' | 'modified' | 'custom';

export async function getNotes(sort: NoteSort = 'created'): Promise<Note[]> {
  const r = await api.get('/notes', { params: { sort } });
  return r.data;
}
export async function createNote(payload: { title: string; content: string }): Promise<Note> {
  const r = await api.post('/notes', payload);
  return r.data;
}
export async function updateNote(id: string, payload: { title: string; content: string }): Promise<Note> {
  const r = await api.patch(`/notes/${id}`, payload);
  return r.data;
}
export async function deleteNote(id: string) {
  await api.delete(`/notes/${id}`);
}
export async function reorderNotes(ids: string[]) {
  const r = await api.put('/notes/reorder', { ids });
  return r.data;
}

/* ---- User prefs (per-user, synced across devices) ---- */
export async function getPrefs(): Promise<Record<string, string[]>> {
  const r = await api.get('/prefs');
  return (r.data?.prefs ?? {}) as Record<string, string[]>;
}

export async function setPref(key: string, value: string[]) {
  await api.put(`/prefs/${key}`, { value });
}

/* ---- Scripts ---- */
export type ScriptPayload = Omit<ScriptItem, 'id'>;
export async function getScripts(): Promise<ScriptItem[]> {
  const r = await api.get('/scripts');
  return r.data;
}
export async function createScript(payload: ScriptPayload): Promise<ScriptItem> {
  const r = await api.post('/scripts', payload);
  return r.data;
}
export async function updateScript(id: string, payload: ScriptPayload): Promise<ScriptItem> {
  const r = await api.patch(`/scripts/${id}`, payload);
  return r.data;
}
export async function deleteScript(id: string) {
  await api.delete(`/scripts/${id}`);
}
