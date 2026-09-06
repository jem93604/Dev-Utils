import { useState } from 'react';
import {
  createScript, deleteScript,
  updateScript, type ScriptPayload,
} from '../../lib/api';
import { useScripts } from '../../hooks/useData';
import { Field, Modal, SectionHeader, TButton, toast } from '../../components/ui';

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

export default ScriptPanel;
