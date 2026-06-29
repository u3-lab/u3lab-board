'use client';
import { useState, useCallback, useEffect } from 'react';
import type { Task, TaskStatus, TaskPriority, TaskCategory, TaskSource } from '@/lib/types';
import type { ScheduleEvent } from '@/app/api/schedule/route';

const PRIORITY_ICON: Record<TaskPriority, string> = { high: '🔴', medium: '🟡', low: '🟢' };
const CATEGORY_LABEL: Record<string, string> = {
  photo: '写真塾', soudan: '相談', myozenji: '明善寺', u3lab: 'U3LAB', sns: 'SNS', other: 'その他',
};
const STATUS_LABEL: Record<TaskStatus, string> = {
  today: '今日', in_progress: '進行中', waiting: '返信待ち', done: '完了', someday: 'いつか',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function todayLabel() {
  const d = new Date();
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`;
}

function CheckCircle({ onDone }: { onDone: () => void }) {
  return (
    <button
      onClick={onDone}
      className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-stone-600 hover:border-green-500 hover:bg-green-900/40 flex items-center justify-center transition-all group/check"
      title="完了にする"
    >
      <span className="text-transparent group-hover/check:text-green-500 text-xs leading-none transition-colors select-none">✓</span>
    </button>
  );
}

function TaskRow({ task, onDone, onStart, onEdit, onDelete, onMarkToday }: {
  task: Task;
  onDone: (id: string) => void;
  onStart: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onMarkToday?: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const isWaiting = task.status === 'waiting';
  const sourceIcon = task.source === 'webhook_line' ? 'LINE' : task.source === 'webhook_slack' ? 'Slack' : '';
  const hasStarted = !!task.started_at;
  const todayStr = new Date().toISOString().slice(0, 10);

  const saveEdit = () => {
    if (editTitle.trim() && editTitle.trim() !== task.title) {
      onEdit(task.id, editTitle.trim());
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-3 border-b border-stone-700">
        <CheckCircle onDone={() => onDone(task.id)} />
        <input
          autoFocus
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') saveEdit();
            if (e.key === 'Escape') { setEditing(false); setEditTitle(task.title); }
          }}
          className="flex-1 min-w-0 text-sm border border-stone-500 rounded px-2 py-1 bg-stone-700 text-stone-100 outline-none focus:border-stone-400"
        />
        <button onClick={saveEdit} className="flex-shrink-0 text-xs px-2 py-1 bg-stone-100 text-stone-900 rounded hover:bg-white">保存</button>
        <button onClick={() => { setEditing(false); setEditTitle(task.title); }} className="flex-shrink-0 text-xs text-stone-400 hover:text-stone-200">キャンセル</button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-stone-700 group/row">
      <CheckCircle onDone={() => onDone(task.id)} />
      <span className="text-base flex-shrink-0">{PRIORITY_ICON[task.priority]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-stone-200 truncate">{task.title}</p>
        <p className="text-xs text-stone-500 mt-0.5">
          {isWaiting && sourceIcon && <span className="mr-1 font-medium text-stone-400">{sourceIcon}:</span>}
          {task.category && task.category !== 'other' && <span className="mr-2">{CATEGORY_LABEL[task.category] ?? task.category}</span>}
          {task.assignee !== 'yuuki' && <span className="mr-2 text-blue-400">→ {task.assignee}</span>}
          {isWaiting
            ? formatDate(task.created_at)
            : task.due_date
              ? <span className={task.due_date <= todayStr ? 'text-red-400' : 'text-stone-400'}>締切 {task.due_date === todayStr ? '今日' : task.due_date}</span>
              : ''}
          {hasStarted && <span className="ml-2 text-green-600 text-xs">▶ 対応中</span>}
          {task.permalink && <a href={task.permalink} target="_blank" rel="noopener noreferrer" className="ml-2 text-stone-600 hover:text-stone-400 transition-colors">↗</a>}
        </p>
      </div>
      {onMarkToday && (
        <button
          onClick={() => onMarkToday(task.id)}
          className="flex-shrink-0 w-4 h-4 rounded-full border border-stone-600 text-stone-500 hover:border-blue-500 hover:bg-blue-900/30 transition-colors opacity-0 group-hover/row:opacity-100 flex items-center justify-center"
          title="今日やる"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
        </button>
      )}
      <button
        onClick={() => setEditing(true)}
        className="flex-shrink-0 text-xs px-1.5 py-1 text-stone-700 hover:text-stone-400 transition-colors opacity-0 group-hover/row:opacity-100"
        title="編集"
      >
        ✎
      </button>
      <button
        onClick={() => { if (window.confirm('このタスクを削除しますか？')) onDelete(task.id); }}
        className="flex-shrink-0 text-xs px-1.5 py-1 text-stone-700 hover:text-red-400 transition-colors opacity-0 group-hover/row:opacity-100 leading-none"
        title="削除"
      >
        ×
      </button>
      {!hasStarted && task.assignee === 'yuuki' && !onMarkToday && (
        <button
          onClick={() => onStart(task.id)}
          className="flex-shrink-0 text-xs px-2 py-1 rounded border border-stone-600 text-stone-500 hover:border-green-600 hover:text-green-500 transition-colors"
          title="開始時刻を記録"
        >
          ▶
        </button>
      )}
    </div>
  );
}

export default function Board() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [doneTasks, setDoneTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'someday'>('today');
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newHasDueDate, setNewHasDueDate] = useState(false);
  const [newDueDate, setNewDueDate] = useState('');

  useEffect(() => {
    const load = async () => {
      const [active, done, sched] = await Promise.all([
        fetch('/api/tasks').then(r => r.json()),
        fetch('/api/tasks?completed_today=true').then(r => r.json()),
        fetch('/api/schedule').then(r => r.json()).catch(() => []),
      ]);
      setTasks(Array.isArray(active) ? active : []);
      setDoneTasks(Array.isArray(done) ? done : []);
      setSchedules(Array.isArray(sched) ? sched : []);
      setLoading(false);
    };
    load();
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const today = tasks.filter(t => t.status === 'today' && !t.due_date);
  const waiting = tasks.filter(t => t.status === 'waiting');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const someday = tasks.filter(t => t.status === 'someday');
  const upcoming = tasks.filter(t => t.due_date && t.status !== 'done' && t.due_date >= todayStr).sort((a, b) => (a.due_date ?? '') < (b.due_date ?? '') ? -1 : 1);

  const markDone = useCallback(async (id: string) => {
    const res = await fetch(`/api/tasks?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'done' }),
    });
    if (res.ok) {
      const updated: Task = await res.json();
      setTasks(ts => ts.filter(t => t.id !== id));
      setDoneTasks(ds => ds.some(t => t.id === updated.id) ? ds : [updated, ...ds]);
    }
  }, []);

  const markStarted = useCallback(async (id: string) => {
    const res = await fetch(`/api/tasks?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ started_at: new Date().toISOString() }),
    });
    if (res.ok) {
      const updated: Task = await res.json();
      setTasks(ts => ts.map(t => t.id === id ? updated : t));
    }
  }, []);

  const markToday = useCallback(async (id: string) => {
    const res = await fetch(`/api/tasks?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'today', due_date: null }),
    });
    if (res.ok) {
      const updated: Task = await res.json();
      setTasks(ts => ts.map(t => t.id === id ? updated : t));
    }
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    const res = await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTasks(ts => ts.filter(t => t.id !== id));
      setDoneTasks(ds => ds.filter(t => t.id !== id));
    }
  }, []);

  const editTask = useCallback(async (id: string, title: string) => {
    const res = await fetch(`/api/tasks?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      const updated: Task = await res.json();
      setTasks(ts => ts.map(t => t.id === id ? updated : t));
    }
  }, []);

  const addTask = async () => {
    if (!newTitle.trim()) return;
    const body: Partial<Task> = {
      title: newTitle.trim(),
      status: newHasDueDate ? 'today' as TaskStatus : 'someday' as TaskStatus,
      priority: newPriority,
      assignee: 'yuuki',
      source: 'manual' as TaskSource,
      ...(newHasDueDate && newDueDate ? { due_date: newDueDate } : {}),
    };
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const created: Task = await res.json();
      setTasks(ts => [created, ...ts]);
    }
    setNewTitle('');
    setNewPriority('medium');
    setNewHasDueDate(false);
    setNewDueDate('');
    setShowAdd(false);
  };

  const tabConfig: { key: 'today' | 'upcoming' | 'someday'; icon: string; label: string; count: number }[] = [
    { key: 'today', icon: '📋', label: '今日のタスク', count: today.length },
    { key: 'upcoming', icon: '⏰', label: '締切が近い', count: upcoming.length },
    { key: 'someday', icon: '📦', label: 'いつか', count: someday.length },
  ];

  return (
    <div className="min-h-screen bg-stone-900">
      {/* Header */}
      <header className="bg-stone-800 border-b border-stone-700 px-6 py-3 flex items-center gap-4 sticky top-0 z-10">
        <h1 className="text-base font-semibold text-stone-100">U3LAB Board</h1>
        <span className="text-xs text-stone-500">{todayLabel()}</span>
        <div className="flex-1" />
        <span className="text-xs text-stone-400 bg-stone-700 px-2 py-1 rounded-full">○ 祐紀</span>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="text-xs px-3 py-1.5 bg-stone-100 text-stone-900 rounded-md hover:bg-white transition-colors"
        >
          + タスク追加
        </button>
      </header>

      {/* Add task form */}
      {showAdd && (
        <div className="bg-stone-800 border-b border-stone-700 px-6 py-4">
          <div className="max-w-2xl flex flex-col gap-3">
            <div className="flex gap-3 flex-wrap">
              <input
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && e.shiftKey) addTask();
                }}
                placeholder="タスクタイトル… (Shift+Enterで登録)"
                className="flex-1 min-w-0 text-sm border border-stone-600 rounded px-3 py-1.5 outline-none focus:border-stone-400 bg-stone-700 text-stone-100 placeholder-stone-500"
              />
              <select value={newPriority} onChange={e => setNewPriority(e.target.value as TaskPriority)} className="text-xs border border-stone-600 rounded px-2 py-1.5 bg-stone-700 text-stone-200">
                <option value="high">🔴 高</option>
                <option value="medium">🟡 中</option>
                <option value="low">🟢 低</option>
              </select>
              <button onClick={addTask} className="text-xs px-3 py-1.5 bg-stone-100 text-stone-900 rounded hover:bg-white">追加</button>
              <button onClick={() => { setShowAdd(false); setNewHasDueDate(false); setNewDueDate(''); }} className="text-xs px-3 py-1.5 text-stone-400 hover:text-stone-200">キャンセル</button>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setNewHasDueDate(v => !v)}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${newHasDueDate ? 'border-blue-500 text-blue-400 bg-blue-900/20' : 'border-stone-600 text-stone-500 hover:border-stone-400 hover:text-stone-300'}`}
              >
                {newHasDueDate ? '⏰ 締切あり' : '締切 なし → いつか'}
              </button>
              {newHasDueDate && (
                <input
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                  className="text-xs border border-stone-600 rounded px-2 py-1.5 bg-stone-700 text-stone-200 outline-none focus:border-blue-500"
                />
              )}
              {!newHasDueDate && (
                <span className="text-xs text-stone-600">→ 📦 いつかに登録されます</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-44 flex-shrink-0 border-r border-stone-700 bg-stone-800 min-h-screen pt-4 hidden md:block">
          {([
            ['today', '今日のタスク', today.length],
            ['waiting', '返信待ち', waiting.length],
            ['in_progress', '進行中', inProgress.length],
            ['upcoming', '締切が近い', upcoming.length],
            ['someday', 'いつか', someday.length],
          ] as [string, string, number][]).map(([k, label, count]) => (
            <div key={k} className="flex items-center justify-between px-4 py-2.5 text-sm text-stone-400 hover:bg-stone-700 cursor-pointer">
              <span>{label}</span>
              {count > 0 && <span className="text-xs bg-stone-700 text-stone-400 px-1.5 py-0.5 rounded-full">{count}</span>}
            </div>
          ))}
          <div className="border-t border-stone-700 mt-2 pt-2">
            <div className="px-4 py-2.5 text-sm text-stone-400 hover:bg-stone-700 cursor-pointer">📅 カレンダー</div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-6 max-w-3xl">
          {loading ? (
            <p className="text-sm text-stone-600 text-center py-12">読み込み中...</p>
          ) : (
            <>
              {/* 今日のスケジュール */}
              {schedules.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                    📅 今日のスケジュール
                    <span className="ml-2 text-stone-600 font-normal normal-case">({schedules.length})</span>
                  </h2>
                  {schedules.map(s => (
                    <div key={s.id} className="flex items-center gap-3 py-2 border-b border-stone-700">
                      <span className="text-xs text-stone-500 w-20 flex-shrink-0 tabular-nums">
                        {s.allDay ? '終日' : `${s.start}${s.end ? `〜${s.end}` : ''}`}
                      </span>
                      <p className="text-sm text-stone-300 truncate">{s.title}</p>
                    </div>
                  ))}
                </section>
              )}

              {/* 3タブ: 今日のタスク / 締切が近い / いつか */}
              <div className="flex gap-0 mb-6 border-b border-stone-700">
                {tabConfig.map(({ key, icon, label, count }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5 ${activeTab === key ? 'text-stone-100 border-stone-300' : 'text-stone-500 border-transparent hover:text-stone-300'}`}
                  >
                    {icon} {label}
                    {count > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${activeTab === key ? 'bg-stone-600 text-stone-200' : key === 'upcoming' ? 'bg-red-900/70 text-red-300' : 'bg-stone-700 text-stone-400'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* タブコンテンツ */}
              <section className="mb-8">
                {activeTab === 'today' && (
                  today.length === 0
                    ? <p className="text-sm text-stone-600 py-4 text-center">タスクなし</p>
                    : today.map(t => <TaskRow key={t.id} task={t} onDone={markDone} onStart={markStarted} onEdit={editTask} onDelete={deleteTask} />)
                )}
                {activeTab === 'upcoming' && (
                  upcoming.length === 0
                    ? <p className="text-sm text-stone-600 py-4 text-center">締切のタスクなし</p>
                    : upcoming.map(t => <TaskRow key={t.id} task={t} onDone={markDone} onStart={markStarted} onEdit={editTask} onDelete={deleteTask} onMarkToday={markToday} />)
                )}
                {activeTab === 'someday' && (
                  someday.length === 0
                    ? <p className="text-sm text-stone-600 py-4 text-center">タスクなし</p>
                    : someday.map(t => <TaskRow key={t.id} task={t} onDone={markDone} onStart={markStarted} onEdit={editTask} onDelete={deleteTask} onMarkToday={markToday} />)
                )}
              </section>

              {/* 返信待ち */}
              <section className="mb-8">
                <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                  📨 返信待ち
                  <span className="ml-2 text-stone-600 font-normal normal-case">({waiting.length})</span>
                </h2>
                {waiting.length === 0
                  ? <p className="text-sm text-stone-600 py-4 text-center">なし</p>
                  : waiting.map(t => <TaskRow key={t.id} task={t} onDone={markDone} onStart={markStarted} onEdit={editTask} onDelete={deleteTask} />)
                }
              </section>

              {/* 進行中 */}
              {inProgress.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                    ⚙️ 進行中
                    <span className="ml-2 text-stone-600 font-normal normal-case">({inProgress.length})</span>
                  </h2>
                  {inProgress.map(t => <TaskRow key={t.id} task={t} onDone={markDone} onStart={markStarted} onEdit={editTask} onDelete={deleteTask} />)}
                </section>
              )}

              {/* 今日の完了 */}
              {doneTasks.length > 0 && (
                <section className="mb-8">
                  <button
                    onClick={() => setShowDone(v => !v)}
                    className="flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3 w-full text-left"
                  >
                    ✅ 今日の完了
                    <span className="text-stone-600 font-normal normal-case">（{doneTasks.length}件）</span>
                    <span className="ml-auto">{showDone ? '▼' : '◀︎'}</span>
                  </button>
                  {showDone && doneTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-3 py-2 border-b border-stone-700 opacity-40">
                      <span className="w-5 h-5 rounded-full border-2 border-green-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-green-500 text-xs leading-none">✓</span>
                      </span>
                      <p className="text-sm text-stone-400 line-through truncate">{t.title}</p>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
