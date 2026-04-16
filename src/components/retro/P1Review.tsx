// ═══ PHASE 1: REPASO — Sprint review + objective ═══
import { useState } from 'preact/hooks';
import type { AppUser } from '@app-types/index';
import { Icon } from '@components/common/Icon';

interface P1ReviewProps {
  tasks: unknown[];
  onUpdateTasks: (tasks: unknown[]) => void;
  objective: string;
  onUpdateObjective: (obj: string) => void;
  user: AppUser;
}

export function P1Review({ tasks, onUpdateTasks, objective, onUpdateObjective, user }: P1ReviewProps) {
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState('');

  const toggleTask = (idx: number) => {
    const next = [...tasks] as any[];
    next[idx] = { ...next[idx], done: !next[idx].done };
    onUpdateTasks(next);
  };

  const addTask = () => {
    if (!newTask.trim()) return;
    onUpdateTasks([...tasks, { text: newTask.trim(), done: false }]);
    setNewTask('');
  };

  const doneCount = (tasks as any[]).filter(t => t.done).length;
  const pct = tasks.length > 0 ? Math.round(doneCount / tasks.length * 100) : 0;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Objective */}
      <div style={{ background: '#FFF', borderRadius: 16, border: '1.5px solid #E5E5EA', padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Objetivo del sprint</h3>
        <input
          value={objective}
          onInput={e => onUpdateObjective((e.target as HTMLInputElement).value)}
          placeholder="¿Cuál era el objetivo principal de este sprint?"
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #E5E5EA', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Task checklist */}
      <div style={{ background: '#FFF', borderRadius: 16, border: '1.5px solid #E5E5EA', padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Checklist del sprint</h3>
          <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 80 ? '#34C759' : pct >= 50 ? '#FF9500' : '#FF3B30' }}>
            {doneCount}/{tasks.length} ({pct}%)
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, background: '#F2F2F7', borderRadius: 3, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#34C759' : pct >= 50 ? '#FF9500' : '#FF3B30', borderRadius: 3, transition: 'width .3s' }} />
        </div>

        {/* Tasks */}
        {(tasks as any[]).map((t, i) => (
          <label key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10,
              background: t.done ? '#F0FFF4' : '#FAFAFA', marginBottom: 4, cursor: 'pointer',
              border: `1px solid ${t.done ? '#34C75920' : '#E5E5EA'}`,
            }}>
            <input type="checkbox" checked={t.done} onChange={() => toggleTask(i)} style={{ accentColor: '#34C759' }} />
            <span style={{ fontSize: 13, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? '#34C759' : '#1D1D1F' }}>
              {t.text}
            </span>
          </label>
        ))}

        {/* Add task */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={newTask} onInput={e => setNewTask((e.target as HTMLInputElement).value)}
            onKeyDown={e => e.key === 'Enter' && addTask()}
            placeholder="Añadir tarea..."
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px dashed #E5E5EA', fontSize: 12, outline: 'none' }} />
          <button onClick={addTask}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#007AFF', color: '#FFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            +
          </button>
        </div>
      </div>
    </div>
  );
}
