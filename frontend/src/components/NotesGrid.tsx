// Shared notes grid: grid-style preview cards, sort control
// (created / modified / custom drag-drop order), full add/edit/delete.
// Drag-drop uses dnd-kit sortable with FLIP animations + drag overlay.
// Used on Home (preview + limit) and the /notes page (full).
import { useState } from 'react';
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
  createNote, deleteNote, getNotes, reorderNotes, updateNote,
  type Note, type NoteSort,
} from '../lib/api';
import { useNotes } from '../hooks/useData';
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

function CardBody({ n, open }: { n: Note; open: boolean }) {
  return (
    <>
      <div className="note-head" style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span>{open ? '▼' : '▶'}</span>
          <span className="note-title-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {n.title}
          </span>
        </div>
      </div>
      <div className="note-body">
        <div className="note-content">{n.content}</div>
        {(n.created_at || n.updated_at) && (
          <div className="note-date">
            {n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}
            {n.updated_at && n.updated_at !== n.created_at
              ? ` · edited ${new Date(n.updated_at).toLocaleDateString()}`
              : ''}
          </div>
        )}
      </div>
    </>
  );
}

function SortableCard({
  n, open, sortable, onToggle, onEdit, onRemove,
}: {
  n: Note; open: boolean; sortable: boolean;
  onToggle: () => void; onEdit: () => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: n.id,
    disabled: !sortable,
  });

  return (
    <div
      ref={setNodeRef}
      className={`note-card${open ? '' : ' collapsed'}`}
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
          <span>{open ? '▼' : '▶'}</span>
          <span className="note-title-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {n.title}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
          <button className="qbtn" onClick={onEdit} title="Edit">✎</button>
          <button className="qbtn qbtn-del" onClick={onRemove} title="Delete">×</button>
        </div>
      </div>
      <div className="note-body" onClick={onToggle}>
        <div className="note-content">{n.content}</div>
        {(n.created_at || n.updated_at) && (
          <div className="note-date">
            {n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}
            {n.updated_at && n.updated_at !== n.created_at
              ? ` · edited ${new Date(n.updated_at).toLocaleDateString()}`
              : ''}
          </div>
        )}
      </div>
    </div>
  );
}

export function NotesGrid({ preview = false, limit = 6 }: { preview?: boolean; limit?: number }) {
  const [sort, setSort] = useState<NoteSort>(loadSort);
  const [notes, setNotes] = useNotes(sort);
  const [open, setOpen] = useState<string | null>(null);
  const [modal, setModal] = useState<null | { id?: string; title: string; content: string }>(null);
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

  const save = async () => {
    if (!modal || !modal.title.trim()) { toast('Title required'); return; }
    try {
      if (modal.id) {
        const updated = await updateNote(modal.id, { title: modal.title.trim(), content: modal.content });
        // edits bump updated_at; in modified view the row moves — refetch to reflect it
        if (sort === 'modified') {
          setNotes(await getNotes(sort));
        } else {
          setNotes((ns) => ns.map((n) => (n.id === updated.id ? { ...n, ...updated } : n)));
        }
        toast('Note updated ✓');
      } else {
        const created = await createNote({ title: modal.title.trim(), content: modal.content });
        setNotes((ns) => (sort === 'custom' ? [...ns, created] : [created, ...ns]));
        toast('Note added ✓');
      }
      setModal(null);
    } catch {
      toast('Save failed');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete note?')) return;
    await deleteNote(id);
    setNotes((ns) => ns.filter((n) => n.id !== id));
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const onDragEnd = async (e: DragEndEvent) => {
    const overId = e.over ? String(e.over.id) : null;
    setActiveId(null);
    if (!overId || e.active.id === e.over?.id || sort !== 'custom') return;
    const order = notes.map((n) => n.id);
    const from = order.indexOf(String(e.active.id));
    const to = order.indexOf(overId);
    if (from < 0 || to < 0) return;
    const next = arrayMove(order, from, to);
    const prev = notes;
    setNotes(next.map((id) => prev.find((n) => n.id === id)!));
    try {
      await reorderNotes(next);
    } catch {
      setNotes(prev);
      toast('Reorder failed');
    }
  };

  const visible = preview ? notes.slice(0, limit) : notes;
  const sortable = sort === 'custom' && !preview;
  const activeNote = activeId ? notes.find((n) => n.id === activeId) : undefined;

  return (
    <section id={preview ? 'sec-notes-preview' : 'sec-notes'} className="section-block">
      <SectionHeader
        color="#fbbf24"
        title="📝 Notes & Snippets"
        badge={`${notes.length}`}
        right={
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={visible.map((n) => n.id)} strategy={rectSortingStrategy}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))',
                gap: 10,
                alignItems: 'start',
              }}
            >
              {visible.map((n) => (
                <SortableCard
                  key={n.id}
                  n={n}
                  open={open === n.id}
                  sortable={sortable}
                  onToggle={() => setOpen((o) => (o === n.id ? null : n.id))}
                  onEdit={() => setModal({ id: n.id, title: n.title, content: n.content })}
                  onRemove={() => remove(n.id)}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease-out' }}>
            {activeNote ? (
              <div className="note-card" style={{ boxShadow: '0 12px 32px rgba(0,0,0,.45)', cursor: 'grabbing' }}>
                <CardBody n={activeNote} open={false} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
      <Modal
        open={modal !== null} onClose={() => setModal(null)}
        title={modal?.id ? 'Edit Note' : 'Add Note'}
        footer={<><TButton onClick={() => setModal(null)}>Cancel</TButton><TButton variant="primary" onClick={save}>Save</TButton></>}
      >
        <Field label="Title *">
          <input value={modal?.title ?? ''} onChange={(e) => setModal((m) => (m ? { ...m, title: e.target.value } : m))} placeholder="e.g. Server Commands" />
        </Field>
        <Field label="Content">
          <textarea value={modal?.content ?? ''} onChange={(e) => setModal((m) => (m ? { ...m, content: e.target.value } : m))} rows={6} placeholder="Multi-line note..." style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.76rem' }} />
        </Field>
      </Modal>
    </section>
  );
}
