// Global content modals: query create/edit, section create, version snapshots.
// Mounted once in App Shell via <ContentModalProvider>; any component can
// open them through useContentModals(). Mutations call notifyContentChanged()
// so every list refetches.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createQuery, createSection, createVersion, deleteQuery, deleteSection, getVersions,
  restoreVersion, updateQuery,
  type Query, type Version,
} from '../lib/api';
import { extractVariables } from '../lib/sql';
import { notifyContentChanged, useSections } from '../hooks/useData';
import { Empty, Field, Modal, TButton, toast } from './ui';

const SECTION_COLORS = ['#f0a500', '#34d399', '#60a5fa', '#a78bfa', '#fb923c', '#22d3ee', '#f472b6', '#f87171'];

interface QueryModalState { query?: Query; defaultSectionId?: string }
interface ContentModalsCtx {
  openCreateQuery: (sectionId?: string) => void;
  openEditQuery: (q: Query) => void;
  openCreateSection: () => void;
  openVersions: () => void;
}

const Ctx = createContext<ContentModalsCtx>({
  openCreateQuery: () => {}, openEditQuery: () => {},
  openCreateSection: () => {}, openVersions: () => {},
});

export const useContentModals = () => useContext(Ctx);

function QueryModal({ state, onClose, onCreateSection }: { state: QueryModalState | null; onClose: () => void; onCreateSection: () => void }) {
  const sections = useSections();
  const editing = state?.query;
  const [title, setTitle] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [steps, setSteps] = useState('');
  const [sql, setSql] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(editing?.title ?? '');
    setSectionId(editing?.section_id ?? state?.defaultSectionId ?? sections[0]?.id ?? '');
    setPurpose(editing?.purpose ?? '');
    setSteps(editing?.steps ?? '');
    setSql(editing?.sql_text ?? '');
  }, [state, editing, sections]);

  const vars = useMemo(() => extractVariables(sql), [sql]);

  if (!state) return null;

  if (sections.length === 0 && !editing) {
    return (
      <Modal open onClose={onClose} title="Add Query">
        <Empty
          icon="📂" text="Create a section first"
          hint="Queries live inside sections — set one up, then come back here"
          action={<TButton variant="primary" onClick={() => { onClose(); onCreateSection(); }}>+ New Section</TButton>}
        />
      </Modal>
    );
  }

  const save = async () => {
    if (!title.trim()) { toast('Title required'); return; }
    if (!sql.trim()) { toast('SQL required'); return; }
    if (!sectionId) { toast('Pick a section'); return; }
    setSaving(true);
    try {
      if (editing) {
        await updateQuery(editing.id, {
          title: title.trim(), section_id: sectionId,
          purpose: purpose.trim(), steps: steps.trim(), sql_text: sql,
        });
        toast('Query updated ✓');
      } else {
        await createQuery({
          section_id: sectionId, title: title.trim(),
          purpose: purpose.trim(), steps: steps.trim(), sql_text: sql,
        });
        toast('Query added ✓');
      }
      notifyContentChanged();
      onClose();
    } catch {
      toast('Save failed — backend unreachable');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open onClose={onClose}
      title={editing ? 'Edit Query' : 'Add Query'}
      sub={vars.length ? `variables: ${vars.map((v) => `{{${v}}}`).join(', ')}` : 'Use {{variable}} for dynamic inputs'}
      wide
      footer={<><TButton onClick={onClose}>Cancel</TButton><TButton variant="primary" onClick={save}>{saving ? 'Saving…' : 'Save Query'}</TButton></>}
    >
      <div className="fg-row">
        <Field label="Query Title *">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Find Invoice Details" />
        </Field>
        <Field label="Section *">
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Purpose / Description">
        <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="What does this query do? When should it be used?" />
      </Field>
      <Field label="SQL / Code *">
        <textarea value={sql} onChange={(e) => setSql(e.target.value)} rows={10}
          placeholder={"SELECT * FROM sales_master WHERE vchr_invoice_num = '{{invoice}}';"}
          style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.74rem', color: 'var(--cyan)', lineHeight: 1.7 }} />
        <div className="fg-hint">
          Variables detected: {vars.length
            ? vars.map((v) => <span key={v} className="chip" style={{ marginRight: 4 }}>{`{{${v}}}`}</span>)
            : 'none yet'}
        </div>
      </Field>
      <Field label="Steps (one per line, optional)">
        <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={4}
          placeholder={"1. Enter the Invoice Number\n2. Run SELECT to verify"} />
      </Field>
    </Modal>
  );
}

function SectionModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(SECTION_COLORS[0]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setName(''); setDescription(''); setColor(SECTION_COLORS[0]); }
  }, [open ]);

  if (!open) return null;

  const save = async () => {
    if (!name.trim()) { toast('Section name required'); return; }
    setSaving(true);
    try {
      await createSection({ name: name.trim(), color, description: description.trim() });
      toast('Section created ✓');
      notifyContentChanged();
      onClose();
    } catch {
      toast('Save failed — backend unreachable');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open onClose={onClose} title="Add Section"
      footer={<><TButton onClick={onClose}>Cancel</TButton><TButton variant="primary" onClick={save}>{saving ? 'Saving…' : 'Create'}</TButton></>}
    >
      <Field label="Section Name *">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Loyalty & Rewards" />
      </Field>
      <Field label="Description">
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What queries does this section contain?" />
      </Field>
      <Field label="Colour">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SECTION_COLORS.map((c) => (
            <button
              key={c} type="button" title={c} onClick={() => setColor(c)}
              style={{
                width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                border: color === c ? '2px solid var(--amber)' : '2px solid transparent',
                outline: 'none',
              }}
            />
          ))}
        </div>
      </Field>
    </Modal>
  );
}

function VersionsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setVersions(await getVersions());
    } catch {
      setVersions([]);
    }
  }, []);

  useEffect(() => {
    if (open) { load(); setRemark(''); }
  }, [open, load]);

  if (!open) return null;

  const save = async () => {
    setBusy(true);
    try {
      await createVersion(remark.trim() || 'Snapshot');
      toast('Snapshot saved ✓');
      setRemark('');
      await load();
      notifyContentChanged();
    } catch {
      toast('Save failed — backend unreachable');
    } finally {
      setBusy(false);
    }
  };

  const restore = async (v: Version) => {
    if (!window.confirm(`Restore snapshot "${v.remark}"? Current content will be replaced.`)) return;
    setBusy(true);
    try {
      await restoreVersion(v.id);
      toast('Snapshot restored ✓');
      notifyContentChanged();
      onClose();
    } catch {
      toast('Restore failed — backend unreachable');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="🕘 Version Snapshots" sub="Restore replaces ALL current content">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={remark} onChange={(e) => setRemark(e.target.value)}
          placeholder="Snapshot remark (e.g. before cleanup…)"
          style={{ flex: 1 }}
        />
        <TButton variant="primary" onClick={save}>{busy ? '…' : '💾 Save'}</TButton>
      </div>
      {versions.length === 0 ? (
        <div className="empty"><div className="empty-text">No snapshots yet</div></div>
      ) : (
        versions.map((v) => (
          <div className="ver-item" key={v.id}>
            <div>
              <div className="ver-remark">{v.remark}</div>
              <div className="ver-date">{v.created_at ? new Date(v.created_at).toLocaleString() : ''}</div>
            </div>
            <TButton onClick={() => restore(v)}>↺ Restore</TButton>
          </div>
        ))
      )}
    </Modal>
  );
}

export function ContentModalProvider({ children }: { children: ReactNode }) {
  const [queryState, setQueryState] = useState<QueryModalState | null>(null);
  const [sectionOpen, setSectionOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const ctx = useMemo<ContentModalsCtx>(() => ({
    openCreateQuery: (sectionId?: string) => setQueryState({ defaultSectionId: sectionId }),
    openEditQuery: (q: Query) => setQueryState({ query: q }),
    openCreateSection: () => setSectionOpen(true),
    openVersions: () => setVersionsOpen(true),
  }), []);

  return (
    <Ctx.Provider value={ctx}>
      {children}
      <QueryModal
        state={queryState}
        onClose={() => setQueryState(null)}
        onCreateSection={() => setSectionOpen(true)}
      />
      <SectionModal open={sectionOpen} onClose={() => setSectionOpen(false)} />
      <VersionsModal open={versionsOpen} onClose={() => setVersionsOpen(false)} />
    </Ctx.Provider>
  );
}

/** Delete a query after confirm; notifies lists to refetch. */
export async function confirmDeleteQuery(q: Query): Promise<boolean> {
  if (!window.confirm(`Delete query "${q.title}"? This cannot be undone.`)) return false;
  try {
    await deleteQuery(q.id);
    toast('Query deleted');
    notifyContentChanged();
    return true;
  } catch {
    toast('Delete failed — backend unreachable');
    return false;
  }
}

/** Delete a section (and its queries) after confirm. */
export async function confirmDeleteSection(id: string, name: string, queryCount: number): Promise<boolean> {
  if (!window.confirm(`Delete section "${name}" and its ${queryCount} quer${queryCount === 1 ? 'y' : 'ies'}? This cannot be undone.`)) return false;
  try {
    await deleteSection(id);
    toast('Section deleted');
    notifyContentChanged();
    return true;
  } catch {
    toast('Delete failed — backend unreachable');
    return false;
  }
}
