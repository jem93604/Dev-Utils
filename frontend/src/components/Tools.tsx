// Utility panels reusing .fmt-* / .note-* / .lib-table theme classes.
// Formatter + Differ are client-only. Notes + Scripts are API-backed.
import { useState } from 'react';
import {
  createNote, createScript, deleteNote, deleteScript,
  updateNote, updateScript, type Note, type ScriptPayload,
} from '../lib/api';
import { diffLines, formatData, type FmtKind } from '../lib/format';
import { useNotes, useScripts } from '../hooks/useData';
import { Field, Modal, SectionHeader, Empty, TButton, toast } from './ui';

export function FormatterPanel() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const run = (t: FmtKind) => {
    const r = formatData(input, t);
    setOutput(r.output);
    if (r.note) toast(r.note);
  };
  return (
    <section id="sec-formatter" className="section-block">
      <SectionHeader color="#94a3b8" title="🛠 Data Formatter" />
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: 16 }}>
        <div className="fmt-grid">
          <div className="fmt-col">
            <label>Input — paste values here</label>
            <textarea className="fmt-textarea" value={input} onChange={(e) => setInput(e.target.value)} placeholder={'25-I-VMF-28819\n25-I-POT-96393'} />
            <div className="fmt-btns">
              {(['sql', 'csv', 'upper', 'lower', 'lines', 'dedup', 'count', 'trim'] as FmtKind[]).map((k) => (
                <button key={k} className="fmt-btn" onClick={() => run(k)}>{k}</button>
              ))}
            </div>
          </div>
          <div className="fmt-col">
            <label>Output — copy from here</label>
            <textarea className="fmt-textarea" readOnly value={output} placeholder="Formatted output appears here..." />
            <div className="fmt-btns">
              <button className="fmt-btn" onClick={() => { navigator.clipboard.writeText(output); toast('Output copied ✓'); }}>⎘ Copy Output</button>
              <button className="fmt-btn" onClick={() => { setInput(output); setOutput(input); }}>⇄ Swap</button>
              <button className="fmt-btn" onClick={() => { setInput(''); setOutput(''); }}>✕ Clear</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DifferPanel() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [ran, setRan] = useState(false);
  const lines = ran ? diffLines(a, b) : [];
  return (
    <section id="sec-diff" className="section-block">
      <SectionHeader color="#60a5fa" title="🔄 SQL Differ" />
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: 16 }}>
        <div className="fmt-grid" style={{ marginBottom: 12 }}>
          <div className="fmt-col"><label>Query A (Original)</label>
            <textarea className="fmt-textarea" style={{ minHeight: 140 }} value={a} onChange={(e) => setA(e.target.value)} /></div>
          <div className="fmt-col"><label>Query B (Modified)</label>
            <textarea className="fmt-textarea" style={{ minHeight: 140 }} value={b} onChange={(e) => setB(e.target.value)} /></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="fmt-btn" onClick={() => setRan(true)}>🔍 Compare</button>
          <button className="fmt-btn" onClick={() => { setA(''); setB(''); setRan(false); }}>✕ Clear</button>
        </div>
        {ran && (
          <div style={{ background: 'var(--code-bg)', border: '1px solid var(--border)', borderRadius: 7, padding: 12, fontFamily: "'JetBrains Mono',monospace", fontSize: '.73rem', lineHeight: 1.8 }}>
            {lines.map((l, i) => (
              <div key={i} className={l.kind === 'added' ? 'diff-added' : l.kind === 'removed' ? 'diff-removed' : undefined} style={{ padding: '1px 4px' }}>
                {l.kind === 'added' ? `+ ${l.text}` : l.kind === 'removed' ? `− ${l.text}` : `  ${l.text}`}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function NotesPanel() {
  const [notes, setNotes] = useNotes();
  const [open, setOpen] = useState<string | null>(null);
  const [modal, setModal] = useState<null | { id?: string; title: string; content: string }>(null);

  const save = async () => {
    if (!modal || !modal.title.trim()) { toast('Title required'); return; }
    try {
      if (modal.id) {
        const updated = await updateNote(modal.id, { title: modal.title.trim(), content: modal.content });
        setNotes((ns) => ns.map((n) => (n.id === updated.id ? updated : n)));
        toast('Note updated ✓');
      } else {
        const created = await createNote({ title: modal.title.trim(), content: modal.content });
        setNotes((ns) => [created, ...ns]);
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

  const startAdd = () => setModal({ title: '', content: '' });
  const startEdit = (n: Note) => setModal({ id: n.id, title: n.title, content: n.content });

  return (
    <section id="sec-notes" className="section-block">
      <SectionHeader
        color="#fbbf24" title="📝 Notes & Snippets"
        right={<TButton onClick={startAdd}>+ Note</TButton>}
      />
      {notes.length === 0 ? <Empty icon="📝" text="No notes yet" hint="Click + Note to add one" /> : (
        <div className="note-grid">
          {notes.map((n) => (
            <div key={n.id} className={`note-card${open === n.id ? '' : ' collapsed'}`}>
              <div className="note-head" onClick={() => setOpen((o) => (o === n.id ? null : n.id))}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{open === n.id ? '▼' : '▶'}</span>
                  <span className="note-title-text">{n.title}</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                  <button className="qbtn" onClick={() => startEdit(n)} title="Edit">✎</button>
                  <button className="qbtn qbtn-del" onClick={() => remove(n.id)} title="Delete">×</button>
                </div>
              </div>
              <div className="note-body">
                <div className="note-content">{n.content}</div>
              </div>
            </div>
          ))}
        </div>
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

const emptyScript: ScriptPayload = { file_name: '', path: '', remark: '', purpose: '', steps: '' };

export function ScriptPanel() {
  const [scripts, setScripts] = useScripts();
  const [editing, setEditing] = useState<null | (ScriptPayload & { id?: string })>(null);

  const save = async () => {
    if (!editing || (!editing.file_name.trim() && !editing.path.trim())) { toast('File name or path required'); return; }
    try {
      if (editing.id) {
        const { id, ...payload } = editing;
        const updated = await updateScript(id, payload);
        setScripts((ss) => ss.map((s) => (s.id === updated.id ? updated : s)));
        toast('Script updated ✓');
      } else {
        const created = await createScript(editing);
        setScripts((ss) => [...ss, created]);
        toast('Script saved ✓');
      }
      setEditing(null);
    } catch {
      toast('Save failed');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Delete script?')) return;
    await deleteScript(id);
    setScripts((ss) => ss.filter((s) => s.id !== id));
  };

  return (
    <section id="sec-library" className="section-block">
      <SectionHeader
        color="#a78bfa" title="📂 Script Library"
        right={<TButton variant="primary" onClick={() => setEditing({ ...emptyScript })}>+ Add</TButton>}
      />
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: 16 }}>
        <table className="lib-table">
          <thead><tr><th>#</th><th>File Name</th><th>Path</th><th>Remark</th><th>Purpose</th><th>Steps</th><th>Actions</th></tr></thead>
          <tbody>
            {scripts.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>No scripts saved yet</td></tr>
            )}
            {scripts.map((s, i) => (
              <tr key={s.id}>
                <td style={{ color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace", fontSize: '.68rem' }}>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{s.file_name}</td>
                <td><code style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '.72rem', color: 'var(--cyan)', cursor: 'pointer' }} onClick={() => { navigator.clipboard.writeText(s.path); toast('Copied ✓'); }} title="Click to copy">{s.path}</code></td>
                <td style={{ color: 'var(--text2)' }}>{s.remark}</td>
                <td style={{ fontSize: '.73rem', color: 'var(--text2)' }}>{s.purpose || '—'}</td>
                <td style={{ fontSize: '.73rem', color: 'var(--text2)', whiteSpace: 'pre-wrap' }}>{s.steps || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexDirection: 'column' }}>
                    <button className="qbtn" onClick={() => setEditing({ ...s })}>✎ Edit</button>
                    <button className="qbtn qbtn-del" onClick={() => remove(s.id)}>× Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal
        open={editing !== null} onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit Script' : 'Add Script'}
        footer={<><TButton onClick={() => setEditing(null)}>Cancel</TButton><TButton variant="primary" onClick={save}>{editing?.id ? '✓ Update' : '+ Add'}</TButton></>}
      >
        <div className="fg-row">
          <Field label="File Name *">
            <input value={editing?.file_name ?? ''} onChange={(e) => setEditing((m) => (m ? { ...m, file_name: e.target.value } : m))} placeholder="File Name" />
          </Field>
          <Field label="Short Remark">
            <input value={editing?.remark ?? ''} onChange={(e) => setEditing((m) => (m ? { ...m, remark: e.target.value } : m))} placeholder="Short Remark" />
          </Field>
        </div>
        <Field label="Full Path (click to copy in table)">
          <input value={editing?.path ?? ''} onChange={(e) => setEditing((m) => (m ? { ...m, path: e.target.value } : m))} placeholder="Full Path" />
        </Field>
        <Field label="Purpose / Description">
          <textarea value={editing?.purpose ?? ''} onChange={(e) => setEditing((m) => (m ? { ...m, purpose: e.target.value } : m))} rows={3} placeholder="What does this script do?" />
        </Field>
        <Field label="Steps to Follow">
          <textarea value={editing?.steps ?? ''} onChange={(e) => setEditing((m) => (m ? { ...m, steps: e.target.value } : m))} rows={3} placeholder={'1. SSH into server\n2. Navigate to path'} />
        </Field>
      </Modal>
    </section>
  );
}
