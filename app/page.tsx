'use client';
import { useState, useCallback } from 'react';
import type { Task, TaskStatus, TaskPriority, TaskCategory } from '@/lib/types';

const PRIORITY_ICON: Record<TaskPriority, string> = { high: '🔴', medium: '🟡', low: '🟢' };
const CATEGORY_LABEL: Record<string, string> = {
  photo: '写真塾', soudan: '相談', myozenji: '明善寺', u3lab: 'U3LAB', sns: 'SNS', other: 'その他',
};
const STATUS_LABEL: Record<TaskStatus, string> = {
  today: '今日', in_progress: '進行中', waiting: '返信待ち', done: '完了', someday: 'いつか',
};

type MockSchedule = { id: string; title: string; start: string; end?: string; category?: string };

const MOCK_SCHEDULES: MockSchedule[] = [
  { id: 's1', title: '朝ミーティング（チーム）', start: '09:00', end: '09:30', category: 'u3lab' },
  { id: 's2', title: '写真塾オンライン相談', start: '14:00', end: '15:00', category: 'photo' },
];

const MOCK_TASKS: Task[] = [
  { id: '1', title: '写真レビュー返信（○○さん）', status: 'today', priority: 'high', due_date: new Date().toISOString().slice(0, 10), assignee: 'yuuki', source: 'manual', category: 'photo', created_at: new Date().toISOString() },
  { id: '2', title: 'LINEシナリオ確認', status: 'today', priority: 'medium', assignee: 'yuuki', source: 'manual', category: 'sns', created_at: new Date().toISOString() },
  { id: '3', title: '経費申請確認（6月分）', status: 'today', priority: 'low', assignee: 'yuuki', source: 'manual', category: 'u3lab', created_at: new Date().toISOString() },
  { id: '4', title: '受講生○○さん → 質問あり', status: 'waiting', priority: 'high', assignee: 'yuuki', source: 'webhook_line', category: 'photo', created_at: new Date(Date.now() - 86400000).toISOString() },
  { id: '5', title: '光 → SNS投稿確認待ち', status: 'waiting', priority: 'medium', assignee: 'yuuki', source: 'webhook_slack', category: 'sns', created_at: new Date(Date.now() - 7200000).toISOString() },
  { id: '6', title: 'IG投稿スケジュール見直し', status: 'in_progress', priority: 'medium', assignee: 'saku', source: 'manual', category: 'sns', created_at: new Date().toISOString() },
  { id: '7', title: '朝のメール確認・返信', status: 'done', priority: 'medium', assignee: 'yuuki', source: 'manual', category: 'other', created_at: new Date().toISOString(), completed_at: new Date().toISOString(), archived_at: new Date().toISOString() },
];

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

function TaskRow({ task, onDone }: { task: Task; onDone: (id: string) => void }) {
  const isWaiting = task.status === 'waiting';
  const sourceIcon = task.source === 'webhook_line' ? 'LINE' : task.source === 'webhook_slack' ? 'Slack' : '';
  return (
    <div className="flex items-center gap-3 py-3 border-b border-stone-700">
      <CheckCircle onDone={() => onDone(task.id)} />
      <span className="text-base flex-shrink-0">{PRIORITY_ICON[task.priority]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-stone-200 truncate">{task.title}</p>
        <p className="text-xs text-stone-500 mt-0.5">
          {isWaiting && sourceIcon && <span className="mr-1 font-medium text-stone-400">{sourceIcon}:</span>}
          {task.category && <span className="mr-2">{CATEGORY_LABEL[task.category] ?? task.category}</span>}
          {task.assignee !== 'yuuki' && <span className="mr-2 text-blue-400">→ {task.assignee}</span>}
          {isWaiting ? formatDate(task.created_at) : task.due_date === new Date().toISOString().slice(0, 10) ? '締切 今日' : ''}
        </p>
      </div>
    </div>
  );
}

export default function Board() {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [showAdd, setShowAdd] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newCategory, setNewCategory] = useState<TaskCategory | ''>('');

  const todayStr = new Date().toISOString().slice(0, 10);
  const today = tasks.filter(t => t.status === 'today' && !t.archived_at);
  const todayDone = tasks.filter(t => t.status === 'done' && t.completed_at && t.completed_at.startsWith(todayStr));
  const waiting = tasks.filter(t => t.status === 'waiting' && !t.archived_at);
  const inProgress = tasks.filter(t => t.status === 'in_progress' && !t.archived_at);
  const upcoming = tasks.filter(t => t.due_date && !t.archived_at && t.status !== 'done' && t.due_date > new Date().toISOString().slice(0, 10)).sort((a, b) => (a.due_date ?? '') < (b.due_date ?? '') ? -1 : 1).slice(0, 3);

  const markDone = useCallback((id: string) => {
    setTasks(ts => ts.map(t => t.id === id ? { ...t, status: 'done', completed_at: new Date().toISOString(), archived_at: new Date().toISOString() } : t));
  }, []);

  const addTask = () => {
    if (!newTitle.trim()) return;
    const t: Task = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      status: 'today',
      priority: newPriority,
      assignee: 'yuuki',
      source: 'manual',
      category: newCategory || null,
      created_at: new Date().toISOString(),
    };
    setTasks(ts => [t, ...ts]);
    setNewTitle(''); setNewPriority('medium'); setNewCategory(''); setShowAdd(false);
  };

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
          <div className="max-w-2xl flex gap-3 flex-wrap">
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTask()}
              placeholder="タスクタイトル..."
              className="flex-1 min-w-0 text-sm border border-stone-600 rounded px-3 py-1.5 outline-none focus:border-stone-400 bg-stone-700 text-stone-100 placeholder-stone-500"
            />
            <select value={newPriority} onChange={e => setNewPriority(e.target.value as TaskPriority)} className="text-xs border border-stone-600 rounded px-2 py-1.5 bg-stone-700 text-stone-200">
              <option value="high">🔴 高</option>
              <option value="medium">🟡 中</option>
              <option value="low">🟢 低</option>
            </select>
            <select value={newCategory} onChange={e => setNewCategory(e.target.value as TaskCategory | '')} className="text-xs border border-stone-600 rounded px-2 py-1.5 bg-stone-700 text-stone-200">
              <option value="">カテゴリ</option>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={addTask} className="text-xs px-3 py-1.5 bg-stone-100 text-stone-900 rounded hover:bg-white">追加</button>
            <button onClick={() => setShowAdd(false)} className="text-xs px-3 py-1.5 text-stone-400 hover:text-stone-200">キャンセル</button>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-44 flex-shrink-0 border-r border-stone-700 bg-stone-800 min-h-screen pt-4 hidden md:block">
          {([['today', '今日のタスク', today.length], ['waiting', '返信待ち', waiting.length], ['in_progress', '進行中', inProgress.length], ['upcoming', '締切が近い', upcoming.length], ['someday', 'いつか', 0]] as [string, string, number][]).map(([k, label, count]) => (
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
          {/* 今日のスケジュール */}
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
              📅 今日のスケジュール
              <span className="ml-2 text-stone-600 font-normal normal-case text-xs">（Googleカレンダー連携 Phase1後半）</span>
            </h2>
            {MOCK_SCHEDULES.map(s => (
              <div key={s.id} className="flex items-center gap-3 py-2 border-b border-stone-700">
                <span className="text-xs text-stone-500 w-20 flex-shrink-0 tabular-nums">{s.start}{s.end ? `〜${s.end}` : ''}</span>
                <p className="text-sm text-stone-300 truncate">{s.title}</p>
                {s.category && <span className="text-xs text-stone-600 flex-shrink-0">{CATEGORY_LABEL[s.category] ?? s.category}</span>}
              </div>
            ))}
          </section>

          {/* 今日のタスク */}
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
              📋 今日のタスク
              <span className="ml-2 text-stone-600 font-normal normal-case">({today.length})</span>
            </h2>
            {today.length === 0
              ? <p className="text-sm text-stone-600 py-4 text-center">タスクなし</p>
              : today.map(t => <TaskRow key={t.id} task={t} onDone={markDone} />)
            }
          </section>

          {/* 返信待ち */}
          <section className="mb-8">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
              📨 返信待ち
              <span className="ml-2 text-stone-600 font-normal normal-case">({waiting.length})</span>
            </h2>
            {waiting.length === 0
              ? <p className="text-sm text-stone-600 py-4 text-center">なし</p>
              : waiting.map(t => <TaskRow key={t.id} task={t} onDone={markDone} />)
            }
          </section>

          {/* 進行中 */}
          {inProgress.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                ⚙️ 進行中
                <span className="ml-2 text-stone-600 font-normal normal-case">({inProgress.length})</span>
              </h2>
              {inProgress.map(t => <TaskRow key={t.id} task={t} onDone={markDone} />)}
            </section>
          )}

          {/* 締切が近い */}
          {upcoming.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">🗓 締切が近い</h2>
              {upcoming.map(t => <TaskRow key={t.id} task={t} onDone={markDone} />)}
            </section>
          )}

          {/* 今日の完了 */}
          {todayDone.length > 0 && (
            <section className="mb-8">
              <button
                onClick={() => setShowDone(v => !v)}
                className="flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3 w-full text-left"
              >
                ✅ 今日の完了
                <span className="text-stone-600 font-normal normal-case">（{todayDone.length}件）</span>
                <span className="ml-auto">{showDone ? '▲' : '▼'}</span>
              </button>
              {showDone && todayDone.map(t => (
                <div key={t.id} className="flex items-center gap-3 py-2 border-b border-stone-700 opacity-40">
                  <span className="w-5 h-5 rounded-full border-2 border-green-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-green-500 text-xs leading-none">✓</span>
                  </span>
                  <p className="text-sm text-stone-400 line-through truncate">{t.title}</p>
                </div>
              ))}
            </section>
          )}

          <p className="text-xs text-stone-700 text-center pt-4">
            ※ 現在はモックデータ表示中。Supabase接続後にリアルタイム同期されます。
          </p>
        </main>
      </div>
    </div>
  );
}
