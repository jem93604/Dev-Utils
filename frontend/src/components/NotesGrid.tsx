// Shared notes grid: excerpt preview cards, local filter, sort control
// (created / modified / custom drag-drop order), full add/edit/delete.
// Drag-drop uses dnd-kit sortable with FLIP animations + drag overlay.
// Used on Home (preview + limit) and the /notes page (full).
import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  createNote, deleteNote, reorderNotes, updateNote,
  type Note, type NoteSort,
} from '../lib/api';
import { fuzzy } from '../lib/fuzzy';
import { formatNoteDate, noteExcerpt, noteWordCount } from '../lib/notes';
import { notifyContentChanged, useNotes } from '../hooks/useData';
import { Field, Modal, SectionHeader, Empty, TButton, toast } from './ui';

const SORT_KEY = 'sqlhub_notes_sort';
const SORTS: { id: NoteSort; label: string }[] = [
  { id: 'created', label: 'Created ↓' },
  { id: 'modified', label: 'Modified ↓' },
  { id: 'custom', label: 'Custom ↕' },
];

function loadSort(): NoteSort {
  try {
    const s = localStorage.getItem(SORT_KEY);
    if (s === 'created' || s === 'modified' || s === 'custom') return s;
  } catch { /* ignore */ }
  return 'created';
}

function dateLabel(n: Note): string {
  const created = formatNoteDate(n.created_at);
  const edited = formatNoteDate(n.updated_at);
  if (created && edited && n.updated_at !== n.created_at) return `${created} · edited ${edited}`;
  return created || edited;
}

function NoteExcerpt({ content, expanded }: { content: string; expanded: boolean }) {
  if (!content.trim()) return <div className="note-empty">No content yet — click ✎ to add some.</div>;
  if (expanded) return <div className="note-content">{content}</div>;
  return <div className="note-content note-excerpt">{noteExcerpt(content)}</div>;
}

function SortableCard({
  n, expanded, sortable, onToggle, onEdit, onRemove,
}: {
  n: Note; expanded: boolean; sortable: boolean;
  onToggle: () => void; onEdit: () => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: n.id,
    disabled: !sortable,
  });

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(n.content || n.title);
      toast('Note copied ✓');
    } catch {
      toast('Copy failed');
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`note-card${expanded ? ' open' : ' collapsed'}`}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : undefined,
        zIndex: isDragging ? 10 : undefined,
      }}
    >
      <div
        className="note-head"
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        style={{ cursor: sortable ? 'default' : 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {sortable && (
            <span
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              style={{ cursor: 'grab', color: 'var(--text3)', touchAction: 'none', padding: '0 2px' }}
              title="Drag to reorder"
            >
              ⋮⋮
            </span>
          )}
          <span aria-hidden style={{ color: 'var(--text3)', fontSize: '.7rem' }}>{expanded ? '▼' : '▶'}</span>
          <span className="note-title-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {n.title}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <button className="qbtn" onClick={copy} title="Copy note content">⎘</button>
          <button className="qbtn" onClick={onEdit} title="Edit">✎</button>
          <button className="qbtn qbtn-del" onClick={onRemove} title="Delete">×</button>
        </div>
      </div>
      <div className="note-body" onClick={onToggle}>
        <NoteExcerpt content={n.content} expanded={expanded} />
        {(n.created_at || n.updated_at) && (
          <div className="note-date">{dateLabel(n)}</div>
        )}
      </div>
    </div>
  );
}

export function NotesGrid({ preview = false, limit = 6 }: { preview?: boolean; limit?: number }) {
  const [sort, setSort] = useState<NoteSort>(loadSort);
  const [notes, setNotes] = useNotes(sort);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState<null | { id?: string; title: string; content: string }>(null);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const pickSort = (s: NoteSort) => {
    setSort(s);
    try {
      localStorage.setItem(SORT_KEY, s);
    } catch { /* ignore */ }
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (saving) return;
    if (!modal || !modal.title.trim()) { toast('Title required'); return; }
    setSaving(true);
    try {
      if (modal.id) {
        await updateNote(modal.id, { title: modal.title.trim(), content: modal.content });
        toast('Note updated ✓');
      } else {
        await createNote({ title: modal.title.trim(), content: modal.content });
        toast('Note added ✓');
      }
      // Refetch everywhere (this grid via useNotes, plus stats + Home preview).
      notifyContentChanged();
      setModal(null);
    } catch {
      toast('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`Delete note "${title}"? This cannot be undone.`)) return;
    try {
      await deleteNote(id);
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      notifyContentChanged();
      toast('Note deleted');
    } catch {
      toast('Delete failed');
    }
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = async (e: DragEndEvent) => {
    const overId = e.over ? String(e.over.id) : null;
    setActiveId(null);
    if (!overId || e.active.id === e.over?.id || sort !== 'custom') return;
    const order = filtered.map((n) => n.id);
    const from = order.indexOf(String(e.active.id));
    const to = order.indexOf(overId);
    if (from < 0 || to < 0) return;
    const next = arrayMove(order, from, to);
    // Optimistic: show the new order immediately, rewind only on failure.
    const prev = notes;
    const byId = new Map(prev.map((n) => [n.id, n]));
    setNotes(next.map((id) => byId.get(id)!).filter(Boolean));
    try {
      await reorderNotes(next);
    } catch {
      setNotes(prev);
      toast('Reorder failed');
    }
  };

  const q = filter.trim();
  const searched = useMemo(
    () => (preview || !q ? notes : fuzzy(q, notes, (n) => `${n.title}\n${n.content}`)),
    [notes, q, preview],
  );
  const filtered = preview ? searched.slice(0, limit) : searched;
  const sortable = sort === 'custom' && !preview && !q;
  const activeNote = activeId ? notes.find((n) => n.id === activeId) : undefined;
  const allExpanded = filtered.length > 0 && filtered.every((n) => expanded.has(n.id));
  const badge = !preview && q ? `${filtered.length}/${notes.length}` : `${notes.length}`;

  return (
    <section id={preview ? 'sec-notes-preview' : 'sec-notes'} className="section-block">
      <SectionHeader
        color="#fbbf24"
        title="📝 Notes & Snippets"
        badge={badge}
        right={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!preview && notes.length > 3 && (
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter notes…"
                aria-label="Filter notes"
                style={{
                  background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 6,
                  padding: '5px 10px', color: 'var(--text)', fontSize: '.72rem', outline: 'none',
                  width: 150,
                }}
              />
            )}
            {!preview && filtered.length > 1 && (
              <button
                className="fmt-btn"
                onClick={() => setExpanded(allExpanded ? new Set() : new Set(filtered.map((n) => n.id)))}
                title={allExpanded ? 'Collapse all' : 'Expand all'}
              >
                {allExpanded ? 'Collapse' : 'Expand'}
              </button>
            )}
            <div style={{ display: 'flex', gap: 4 }}>
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  className="fmt-btn"
                  onClick={() => pickSort(s.id)}
                  title={s.id === 'custom' ? 'Drag cards to reorder' : `Sort by ${s.id}`}
                  style={sort === s.id ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <TButton onClick={() => setModal({ title: '', content: '' })}>+ Note</TButton>
            {preview && notes.length > limit && (
              <NavLink to="/notes" className="tbtn" style={{ textDecoration: 'none' }}>
                View all →
              </NavLink>
            )}
          </div>
        }
      />
      {sortable && notes.length > 1 && (
        <div style={{ fontSize: '.7rem', color: 'var(--text3)', marginBottom: 8 }}>
          Drag cards by the ⋮⋮ grip to reorder — order saves automatically.
        </div>
      )}
      {notes.length === 0 ? (
        <Empty icon="📝" text="No notes yet" hint="Click + Note to add one" />
      ) : filtered.length === 0 ? (
        <Empty icon="⌕" text={`No notes match "${q}"`} hint="Clear the filter to see everything" />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={filtered.map((n) => n.id)} strategy={rectSortingStrategy}>
            <div className="notes-grid">
              {filtered.map((n) => (
                <SortableCard
                  key={n.id}
                  n={n}
                  expanded={expanded.has(n.id)}
                  sortable={sortable}
                  onToggle={() => toggle(n.id)}
                  onEdit={() => setModal({ id: n.id, title: n.title, content: n.content })}
                  onRemove={() => remove(n.id, n.title)}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease-out' }}>
            {activeNote ? (
              <div className="note-card open" style={{ boxShadow: '0 12px 32px rgba(0,0,0,.45)', cursor: 'grabbing' }}>
                <div className="note-head">
                  <span className="note-title-text">{activeNote.title}</span>
                </div>
                <div className="note-body">
                  <NoteExcerpt content={activeNote.content} expanded={false} />
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
      <Modal
        open={modal !== null} onClose={() => setModal(null)}
        title={modal?.id ? 'Edit Note' : 'Add Note'}
        sub={modal && modal.content.trim() ? `${noteWordCount(modal.content)} words` : undefined}
        footer={<><TButton onClick={() => setModal(null)}>Cancel</TButton><TButton variant="primary" onClick={save}>{saving ? 'Saving…' : 'Save'}</TButton></>}
      >
        <Field label="Title *">
          <input
            value={modal?.title ?? ''}
            onChange={(e) => setModal((m) => (m ? { ...m, title: e.target.value } : m))}
            placeholder="e.g. Server Commands"
            maxLength={300}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        </Field>
        <Field label="Content" hint="Ctrl+Enter to save">
          <textarea
            value={modal?.content ?? ''}
            onChange={(e) => setModal((m) => (m ? { ...m, content: e.target.value } : m))}
            onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') save(); }}
            rows={8}
            placeholder="Multi-line note…"
            style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.76rem' }}
          />
        </Field>
      </Modal>
    </section>
  );
}
