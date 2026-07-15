'use client';
import { useState, useCallback, useEffect } from 'react';
import type { Task, TaskStatus, TaskPriority, TaskCategory, TaskSource, Project, ProjectStatus, Reel, ReelStatus, ReelKind } from '@/lib/types';
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

function HelpTip({ text }: { text: string }) {
  return (
    <span className="relative group/tip ml-1 cursor-default inline-flex items-center">
      <span className="text-stone-600 text-xs border border-stone-700 rounded-full w-3.5 h-3.5 inline-flex items-center justify-center leading-none hover:text-stone-400 hover:border-stone-500 transition-colors select-none">?</span>
      <span className="absolute left-0 bottom-full mb-1.5 w-52 text-xs text-stone-300 bg-stone-800 border border-stone-600 rounded px-2.5 py-2 opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-20 leading-relaxed shadow-lg">
        {text}
      </span>
    </span>
  );
}

function StatusToggle({ status, onStart, onDone }: { status: string; onStart: () => void; onDone: () => void }) {
  const isInProgress = status === 'in_progress';
  return isInProgress ? (
    <button
      onClick={onDone}
      className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-green-600 bg-green-900/30 hover:border-green-400 hover:bg-green-800/50 flex items-center justify-center transition-all"
      title="完了にする"
    >
      <span className="text-green-500 text-xs leading-none select-none">✓</span>
    </button>
  ) : (
    <button
      onClick={onStart}
      className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-stone-600 hover:border-blue-500 hover:bg-blue-900/30 flex items-center justify-center transition-all group/check"
      title="開始する"
    >
      <span className="text-transparent group-hover/check:text-blue-400 text-xs leading-none transition-colors select-none">▶</span>
    </button>
  );
}

function TaskRow({ task, onDone, onStart, onEdit, onDelete, onMarkToday, project, onOpenProject, onSetNextAction }: {
  task: Task;
  onDone: (id: string) => void;
  onStart: (id: string) => void;
  onEdit: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onMarkToday?: (id: string) => void;
  project?: Project;
  onOpenProject?: (p: Project) => void;
  onSetNextAction?: (task: Task) => void;
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
        <StatusToggle status={task.status} onStart={() => onStart(task.id)} onDone={() => onDone(task.id)} />
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
      <StatusToggle status={task.status} onStart={() => onStart(task.id)} onDone={() => onDone(task.id)} />
      <span className="text-base flex-shrink-0">{task.status === 'in_progress' ? '🔵' : PRIORITY_ICON[task.priority]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-stone-200 truncate">{task.title}</p>
        <p className="text-xs text-stone-500 mt-0.5">
          {project && (
            <button
              onClick={e => { e.stopPropagation(); onOpenProject?.(project); }}
              className="mr-2 px-1.5 py-0.5 rounded border border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-200 transition-colors"
              title={`プロジェクト: ${project.name}`}
            >
              {project.no != null ? `No.${project.no} ` : ''}{project.name}
            </button>
          )}
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
      {onSetNextAction && task.project_id && (
        <button
          onClick={() => onSetNextAction(task)}
          className={`flex-shrink-0 text-xs px-1.5 py-1 transition-colors ${
            task.is_next_action ? 'text-orange-400' : 'text-stone-700 hover:text-stone-400 opacity-0 group-hover/row:opacity-100'
          }`}
          title={task.is_next_action ? '次の一手（解除）' : '次の一手にする'}
        >
          {task.is_next_action ? '▶' : '▷'}
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
    </div>
  );
}

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  focus: '🔥 今週動かす', scheduled: '📅 日付が来る', waiting: '⏳ 待ち', seed: '🌱 種・寝かせ', done: '✅ 完了',
};
const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  focus: 'text-orange-400', scheduled: 'text-blue-400', waiting: 'text-yellow-400', seed: 'text-emerald-400', done: 'text-stone-500',
};
const FOCUS_SOFT_LIMIT = 7;
const STALL_DAYS = 7;

// カテゴリ実データ（10種、2026-07-15時点）を6色に統合。未知のカテゴリはstoneにフォールバック。
const CATEGORY_META: Record<string, { icon: string; border: string }> = {
  'オフ会・イベント': { icon: '📸', border: 'border-l-sky-500' },
  '撮影案件': { icon: '📸', border: 'border-l-sky-500' },
  '写真塾': { icon: '📸', border: 'border-l-sky-500' },
  'U3LAB法人・事業基盤': { icon: '🏢', border: 'border-l-emerald-500' },
  '事業・ブランド': { icon: '🏢', border: 'border-l-emerald-500' },
  '書籍出版': { icon: '📚', border: 'border-l-amber-500' },
  '寺院・明善寺': { icon: '⛩', border: 'border-l-purple-500' },
  'システム・自動化': { icon: '🛠', border: 'border-l-stone-500' },
  '個人事務': { icon: '👤', border: 'border-l-pink-500' },
  '相談': { icon: '💬', border: 'border-l-pink-500' },
};
const CATEGORY_DEFAULT = { icon: '🛠', border: 'border-l-stone-500' };
const categoryMeta = (category?: string | null) => (category && CATEGORY_META[category]) || CATEGORY_DEFAULT;

// focusレーンで7日間 動き(activity_date)がない＝停滞バッジ
function isStalled(project: Project): boolean {
  if (project.status !== 'focus' || !project.activity_date) return false;
  const days = (Date.now() - new Date(project.activity_date).getTime()) / 86400000;
  return days >= STALL_DAYS;
}
// waitingでフォロー予定日を過ぎている＝赤バッジ
function isFollowUpOverdue(project: Project): boolean {
  if (project.status !== 'waiting' || !project.follow_up_date) return false;
  const todayStr = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  return project.follow_up_date < todayStr;
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const meta = categoryMeta(project.category);
  const stalled = isStalled(project);
  const followUpOverdue = isFollowUpOverdue(project);
  const dangerOpen = project.danger_flag && !project.danger_ack;
  return (
    <div
      onClick={onClick}
      className={`border-l-4 ${dangerOpen ? 'border-l-red-500 bg-red-950 border-y border-r border-red-700' : `${meta.border} border-y border-r border-stone-700 bg-stone-800/50`} rounded-lg p-4 hover:border-stone-500 cursor-pointer transition-colors`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium text-stone-100 leading-snug">
          <span className="mr-1">{meta.icon}</span>
          {project.no != null && <span className="text-stone-500 mr-1">No.{project.no}</span>}
          {project.name}
          {project.kind === 'routine' && <span className="ml-2 text-xs text-stone-500 border border-stone-600 rounded px-1">常設</span>}
          {project.done_candidate && project.status !== 'done' && (
            <span className="ml-2 text-xs text-emerald-400 border border-emerald-700 rounded px-1">完了候補</span>
          )}
          {dangerOpen && <span className="ml-2 text-xs text-red-300 border border-red-600 rounded px-1">⚠️ 未確認</span>}
        </p>
        <span className={`text-xs flex-shrink-0 font-medium ${PROJECT_STATUS_COLOR[project.status]}`}>
          {PROJECT_STATUS_LABEL[project.status]}
        </span>
      </div>
      {project.summary && (
        <p className="text-xs text-stone-400 mb-1.5 line-clamp-1">{project.summary}</p>
      )}
      {project.next_action && (
        <p className="text-xs text-stone-400 mb-2 line-clamp-2">→ {project.next_action}</p>
      )}
      {stalled && <p className="text-xs text-red-400 mb-1.5">⚠ {STALL_DAYS}日動きなし</p>}
      {followUpOverdue && <p className="text-xs text-red-400 mb-1.5">⚠ フォロー予定日超過（{project.follow_up_date}）</p>}
      <div className="flex items-center gap-3 text-xs text-stone-600 flex-wrap">
        {(project.task_count_today ?? 0) > 0 && (
          <span className="text-blue-400">今日やる {project.task_count_today}</span>
        )}
        {project.due_date && <span className="text-stone-500">期限 {project.due_date}</span>}
        {project.status === 'waiting' && project.follow_up_date && (
          <span className={followUpOverdue ? 'text-red-400' : 'text-stone-500'}>フォロー {project.follow_up_date}</span>
        )}
        {project.blocker_type && project.blocker_type !== 'none' && (
          <span className="text-red-400">⚠ {project.blocker_type === 'external' ? '外部待ち' : '内部ブロック'}</span>
        )}
        <span className="text-stone-600">未完{project.task_count_open ?? 0}／済{project.task_count_done ?? 0}</span>
        {project.activity_date && <span className="ml-auto text-stone-600">更新 {formatDate(project.activity_date)}</span>}
      </div>
    </div>
  );
}

const KIND_LABEL: Record<string, string> = { shokunin: '住職', shashinka: '写真家', ldl: 'LDL', kokoro: 'こころをうつす', other: 'その他' };
const KIND_COLOR: Record<string, string> = { shokunin: 'text-amber-400', shashinka: 'text-sky-400', ldl: 'text-emerald-400', kokoro: 'text-pink-400', other: 'text-stone-400' };
// アカウント別カード色分け（surge の getCardColor(accountId) 相当・ステータス非依存・ダーク配色に翻案）
const KIND_ACCENT_BORDER: Record<string, string> = {
  shokunin: 'border-l-amber-500', shashinka: 'border-l-sky-500', ldl: 'border-l-emerald-500', kokoro: 'border-l-pink-500', other: 'border-l-stone-500',
};
const ACCOUNT_CARD_STYLE: Record<string, string> = {
  shokunin: `border-l-4 ${KIND_ACCENT_BORDER.shokunin} bg-amber-950/20`,
  shashinka: `border-l-4 ${KIND_ACCENT_BORDER.shashinka} bg-sky-950/20`,
  ldl: `border-l-4 ${KIND_ACCENT_BORDER.ldl} bg-emerald-950/20`,
  kokoro: `border-l-4 ${KIND_ACCENT_BORDER.kokoro} bg-pink-950/20`,
  other: `border-l-4 ${KIND_ACCENT_BORDER.other} bg-stone-800`,
};
const REEL_STATUS_ORDER: ReelStatus[] = ['下書き', '収録待ち', '撮影済み', '予約済み', '投稿済み', '削除予定'];
const REEL_STATUS_COLOR: Record<ReelStatus, string> = {
  '下書き': 'border-stone-600 text-stone-400',
  '収録待ち': 'border-yellow-700 text-yellow-400',
  '撮影済み': 'border-blue-700 text-blue-400',
  '予約済み': 'border-green-700 text-green-400',
  '投稿済み': 'border-stone-600 text-stone-500',
  '削除予定': 'border-red-900 text-red-600',
};

function CopyButton({ text, label = 'コピー' }: { text: string | null | undefined; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`text-xs px-2 py-0.5 rounded border transition-colors ${copied ? 'border-green-700 text-green-400' : 'border-stone-600 text-stone-400 hover:text-stone-200 hover:border-stone-400'}`}
    >
      {copied ? '✓ コピーしました' : label}
    </button>
  );
}

// ステータス連動クイックコピー（surgeの copyScript/copyCaption を移植）。
// 収録待ち=タイトル+本文をコピー、撮影済み=キャプション単体をコピー、それ以外は出さない。
// quickPublish（予約済み→投稿済みのワンクリック）は移植しない——今日の暴発防止ガード
// およびIG-Monitor④の実IG確認込み自動flipと衝突するため（海判断・2026-07-10）。
function quickCopyFor(reel: Reel): { label: string; text: string } | null {
  if (reel.status === '収録待ち' && reel.script) return { label: 'シナリオをコピー', text: `${reel.theme ?? ''}\n\n${reel.script}` };
  if (reel.status === '撮影済み' && reel.caption) return { label: 'キャプションをコピー', text: reel.caption };
  return null;
}

function QuickCopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async e => {
        e.stopPropagation();
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={label}
      className={`w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-lg transition-colors ${copied ? 'text-green-400' : 'text-stone-500 hover:text-stone-200 hover:bg-stone-700'}`}
    >
      {copied ? '✓' : '📋'}
    </button>
  );
}

// リールカード（read-only ミラー・2026-07-13 B-1）。ステータス変更/削除は撤去（正=祐紀さんboard）。
function ReelCard({ reel, onOpen }: {
  reel: Reel;
  onOpen: (reel: Reel) => void;
}) {
  const quickCopy = quickCopyFor(reel);
  return (
    <div className={`rounded-lg p-3 text-xs group/card cursor-pointer hover:brightness-125 transition-[filter] ${ACCOUNT_CARD_STYLE[reel.kind] ?? ACCOUNT_CARD_STYLE.other}`} onClick={() => onOpen(reel)}>
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className={`font-medium text-xs ${KIND_COLOR[reel.kind] ?? 'text-stone-400'}`}>{KIND_LABEL[reel.kind] ?? reel.kind}</span>
      </div>
      <p className="text-stone-200 text-sm leading-snug mb-2 line-clamp-2">{reel.theme ?? '(テーマ未設定)'}</p>
      {reel.publish_date && <p className="text-stone-500 mb-2">📅 {reel.publish_date}</p>}
      {reel.memo && <p className="text-stone-600 truncate mb-2">{reel.memo}</p>}
      <div className="flex items-center justify-between gap-2">
        <span className={`border rounded px-1.5 py-0.5 text-xs ${REEL_STATUS_COLOR[reel.status]}`}>{reel.status}</span>
        <div className="flex items-center gap-1">
          {quickCopy && <QuickCopyButton label={quickCopy.label} text={quickCopy.text} />}
        </div>
      </div>
    </div>
  );
}

// リール詳細パネル（read-only ミラー・2026-07-13 B-1）。編集・保存・削除は撤去。
// 状態の正は祐紀さんの reel board（Firebase）。ここは表示とコピー専用（光のシナリオ/キャプション取り出しは維持）。
function ReelDetailPanel({ reel, onClose }: {
  reel: Reel;
  onClose: () => void;
}) {
  const bulkText = [reel.theme, '', reel.script, '', reel.caption].filter(v => v !== undefined && v !== null).join('\n');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-stone-800 border border-stone-700 rounded-lg p-5 w-full max-w-2xl mt-8 mb-8 flex flex-col gap-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-stone-200 font-semibold">リール詳細</h2>
          <div className="flex items-center gap-2">
            <CopyButton text={bulkText} label="📋 一括コピー" />
            <button onClick={onClose} className="text-stone-500 hover:text-stone-200 text-sm">✕</button>
          </div>
        </div>

        <p className="text-xs text-stone-500">祐紀さんの reel board の読み取り専用ミラーです（ここでは編集できません）</p>

        <div className={`pl-3 border-l-4 ${KIND_ACCENT_BORDER[reel.kind] ?? KIND_ACCENT_BORDER.other}`}>
          <p className="text-base text-stone-100 font-medium leading-snug">{reel.theme ?? '(テーマ未設定)'}</p>
          <div className="flex gap-2 flex-wrap mt-2 text-xs items-center">
            <span className={`${KIND_COLOR[reel.kind] ?? 'text-stone-400'}`}>{KIND_LABEL[reel.kind] ?? reel.kind}</span>
            <span className={`border rounded px-1.5 py-0.5 ${REEL_STATUS_COLOR[reel.status] ?? 'border-stone-600 text-stone-400'}`}>{reel.status}</span>
            {reel.publish_date && <span className="text-stone-500">公開日 {reel.publish_date}</span>}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-stone-500">本文（シナリオ）</label>
            <CopyButton text={reel.script} />
          </div>
          <pre className="w-full text-sm border border-stone-700 rounded px-3 py-2 bg-stone-900 text-stone-200 whitespace-pre-wrap font-mono leading-relaxed max-h-80 overflow-y-auto">{reel.script ?? '（未入力）'}</pre>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-stone-500">キャプション</label>
            <CopyButton text={reel.caption} />
          </div>
          <pre className="w-full text-sm border border-stone-700 rounded px-3 py-2 bg-stone-900 text-stone-200 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">{reel.caption ?? '（未入力）'}</pre>
        </div>

        {reel.chatgpt_url && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-stone-500 truncate">ChatGPT URL: {reel.chatgpt_url}</span>
            <CopyButton text={reel.chatgpt_url} />
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-stone-700">
          <button onClick={onClose} className="text-xs px-3 py-1.5 text-stone-400 hover:text-stone-200">閉じる</button>
        </div>
      </div>
    </div>
  );
}

// リールビュー（read-only ミラー・2026-07-13 B-1）。追加/編集/ステータス操作は撤去し表示専用。
function ReelsView({
  reels, view, month,
  onViewChange, onMonthChange, onOpen,
}: {
  reels: Reel[];
  view: 'alert' | 'kanban' | 'calendar';
  month: string;
  onViewChange: (v: 'alert' | 'kanban' | 'calendar') => void;
  onMonthChange: (m: string) => void;
  onOpen: (reel: Reel) => void;
}) {
  const [kanbanNearOnly, setKanbanNearOnly] = useState(true);
  const [y, m] = month.split('-').map(Number);
  const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;

  // Alert: 過去日 × 未投稿
  const jstToday = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  const alertReels = reels.filter(r => r.publish_date && r.publish_date < jstToday && r.status !== '投稿済み' && r.status !== '下書き')
    .sort((a, b) => (a.publish_date ?? '') < (b.publish_date ?? '') ? -1 : 1);

  // Calendar helpers
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstDow = new Date(y, m - 1, 1).getDay(); // 0=Sun
  const calCells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const reelsByDate: Record<string, Reel[]> = {};
  for (const r of reels) {
    if (r.publish_date) {
      if (!reelsByDate[r.publish_date]) reelsByDate[r.publish_date] = [];
      reelsByDate[r.publish_date].push(r);
    }
  }

  return (
    <div>
      {/* toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1 text-sm text-stone-300">
          <button onClick={() => onMonthChange(prevMonth)} className="px-2 py-1 text-stone-500 hover:text-stone-200">◀</button>
          <span className="tabular-nums">{y}年{m}月</span>
          <button onClick={() => onMonthChange(nextMonth)} className="px-2 py-1 text-stone-500 hover:text-stone-200">▶</button>
        </div>
        <div className="flex rounded overflow-hidden border border-stone-700">
          <button onClick={() => onViewChange('alert')} className={`px-3 py-1 text-xs transition-colors ${view === 'alert' ? 'bg-red-900/60 text-red-300' : 'text-stone-500 hover:text-stone-300'}`}>
            ⚠ 要確認{alertReels.length > 0 && <span className="ml-1 text-red-400 font-semibold">{alertReels.length}</span>}
          </button>
          <button onClick={() => onViewChange('kanban')} className={`px-3 py-1 text-xs transition-colors ${view === 'kanban' ? 'bg-stone-700 text-stone-100' : 'text-stone-500 hover:text-stone-300'}`}>かんばん</button>
          <button onClick={() => onViewChange('calendar')} className={`px-3 py-1 text-xs transition-colors ${view === 'calendar' ? 'bg-stone-700 text-stone-100' : 'text-stone-500 hover:text-stone-300'}`}>カレンダー</button>
        </div>
        {view === 'kanban' && (
          <button
            onClick={() => setKanbanNearOnly(v => !v)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${kanbanNearOnly ? 'border-stone-500 text-stone-200' : 'border-stone-700 text-stone-500 hover:text-stone-300'}`}
            title="配信日が近いもの・未設定のみ表示（それ以外の先の予定は隠す）"
          >
            {kanbanNearOnly ? '📅 近日のみ表示中' : '📅 全件表示中'}
          </button>
        )}
        <div className="flex-1" />
        <span className="text-xs text-stone-600">祐紀さんの reel board のミラー（表示専用）</span>
      </div>

      {reels.length === 0 && (
        <p className="text-sm text-stone-600 py-8 text-center">表示できるリールがありません</p>
      )}

      {/* alert view */}
      {view === 'alert' && (
        <div>
          {alertReels.length === 0 ? (
            <p className="text-sm text-stone-600 py-8 text-center">要確認なし 🎉</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-stone-500 mb-2">過去日 × 未投稿（{alertReels.length}件）— 配信状況の更新は祐紀さんの reel board で行われます（ここは表示のみ）</p>
              {alertReels.map(r => (
                <div key={r.id} className="bg-stone-800 border border-red-900/50 rounded-lg p-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpen(r)}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium ${KIND_COLOR[r.kind] ?? 'text-stone-400'}`}>{KIND_LABEL[r.kind] ?? r.kind}</span>
                      <span className={`border rounded px-1.5 py-0.5 text-xs ${REEL_STATUS_COLOR[r.status as ReelStatus] ?? 'border-stone-600 text-stone-400'}`}>{r.status}</span>
                      {r.publish_date && <span className="text-xs text-red-400">📅 {r.publish_date}</span>}
                    </div>
                    <p className="text-sm text-stone-200 leading-snug truncate">{r.theme ?? '(テーマ未設定)'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* kanban view */}
      {view === 'kanban' && reels.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          {REEL_STATUS_ORDER.filter(s => reels.some(r => r.status === s)).map(status => {
            const NEAR_PAST_DAYS = 7;
            const NEAR_FUTURE_DAYS = 21;
            const nearStart = new Date(Date.now() + (9 - NEAR_PAST_DAYS * 24) * 3600 * 1000).toISOString().slice(0, 10);
            const nearEnd = new Date(Date.now() + (9 + NEAR_FUTURE_DAYS * 24) * 3600 * 1000).toISOString().slice(0, 10);

            const columnReels = reels
              .filter(r => r.status === status)
              .filter(r => !kanbanNearOnly || (r.publish_date && r.publish_date >= nearStart && r.publish_date <= nearEnd))
              .sort((a, b) => (a.publish_date ?? '9999') < (b.publish_date ?? '9999') ? -1 : 1);
            const totalInStatus = reels.filter(r => r.status === status).length;

            return (
              <div key={status}>
                <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${REEL_STATUS_COLOR[status]}`}>
                  {status} ({columnReels.length}{kanbanNearOnly && columnReels.length !== totalInStatus ? ` / 全${totalInStatus}` : ''})
                </h3>
                {columnReels.length === 0 ? (
                  <p className="text-xs text-stone-600">（近日の配信予定なし）</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {columnReels.map(r => (
                      <ReelCard key={r.id} reel={r} onOpen={onOpen} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* calendar view */}
      {view === 'calendar' && (
        <div>
          <div className="grid grid-cols-7 gap-px mb-1">
            {['日','月','火','水','木','金','土'].map(d => (
              <div key={d} className="text-center text-xs text-stone-600 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-stone-800 border border-stone-700 rounded-lg overflow-hidden">
            {calCells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} className="bg-stone-900 min-h-16 p-1" />;
              const dateStr = `${month}-${String(day).padStart(2, '0')}`;
              const dayReels = reelsByDate[dateStr] ?? [];
              const todayStr = new Date().toISOString().slice(0, 10);
              const isToday = dateStr === todayStr;
              return (
                <div key={dateStr} className={`bg-stone-900 min-h-16 p-1 ${isToday ? 'ring-1 ring-inset ring-stone-500' : ''}`}>
                  <p className={`text-xs mb-1 ${isToday ? 'text-stone-200 font-semibold' : 'text-stone-600'}`}>{day}</p>
                  {dayReels.map(r => (
                    <div key={r.id} onClick={() => onOpen(r)} className={`text-xs rounded px-1 py-0.5 mb-0.5 truncate cursor-pointer hover:bg-stone-700 ${KIND_COLOR[r.kind] ?? 'text-stone-400'} bg-stone-800`} title={r.theme ?? ''}>
                      {KIND_LABEL[r.kind]} {r.theme ? r.theme.slice(0, 8) : ''}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Board() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [doneTasks, setDoneTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [activeNav, setActiveNav] = useState<'tasks' | 'projects'>('tasks');

  // ?tab=projects などでの深いリンク（レビュー用URL共有のため・2026-07-10）
  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'projects' || tab === 'tasks') setActiveNav(tab);
  }, []);
  const [reels, setReels] = useState<Reel[]>([]);
  const [reelsView, setReelsView] = useState<'alert' | 'kanban' | 'calendar'>('alert');
  const [reelMonth, setReelMonth] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedReel, setSelectedReel] = useState<Reel | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'someday'>('today');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [newLogContent, setNewLogContent] = useState('');
  const [newLogType, setNewLogType] = useState<'progress' | 'milestone_done'>('progress');
  const [showLogForm, setShowLogForm] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const [showAllDone, setShowAllDone] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newDest, setNewDest] = useState<'today' | 'due' | 'someday'>('today');
  const [newDueDate, setNewDueDate] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [showDoneProjects, setShowDoneProjects] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [active, done, sched, proj] = await Promise.all([
        fetch('/api/tasks').then(r => r.json()),
        fetch('/api/tasks?completed_today=true').then(r => r.json()),
        fetch('/api/schedule').then(r => r.json()).catch(() => []),
        fetch('/api/projects').then(r => r.json()).catch(() => []),
      ]);
      setTasks(Array.isArray(active) ? active : []);
      setDoneTasks(Array.isArray(done) ? done : []);
      setSchedules(Array.isArray(sched) ? sched : []);
      setProjects(Array.isArray(proj) ? proj : []);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    fetch(`/api/reels`).then(r => r.json()).then(d => setReels(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const today = tasks.filter(t => t.status === 'today' && !t.due_date);
  const waiting = tasks.filter(t => t.status === 'waiting');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const someday = tasks.filter(t => t.status === 'someday');
  const upcoming = tasks.filter(t => t.due_date && t.status !== 'done' && t.due_date >= todayStr).sort((a, b) => (a.due_date ?? '') < (b.due_date ?? '') ? -1 : 1);
  const relatedTasks = selectedProject
    ? tasks.filter(t => t.project_id === selectedProject.id && t.status !== 'done' && t.status !== 'someday')
    : [];
  const projectsById = new Map(projects.map(p => [p.id, p]));
  const openProject = useCallback((p: Project) => { setActiveNav('projects'); setSelectedProject(p); }, []);

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

  const markUndone = useCallback(async (id: string) => {
    const res = await fetch(`/api/tasks?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'today', completed_at: null, archived_at: null, started_at: null }),
    });
    if (res.ok) {
      const updated: Task = await res.json();
      setDoneTasks(ds => ds.filter(t => t.id !== id));
      setTasks(ts => [updated, ...ts]);
    }
  }, []);

  const markStarted = useCallback(async (id: string) => {
    const res = await fetch(`/api/tasks?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress', started_at: new Date().toISOString() }),
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

  // 「次の一手」は1プロジェクトにつき1つの想定。指定時は同プロジェクトの他の次の一手を解除。
  const setNextAction = useCallback(async (task: Task) => {
    const wasSet = !!task.is_next_action;
    const siblings = tasks.filter(t => t.project_id === task.project_id && t.is_next_action && t.id !== task.id);
    await Promise.all(siblings.map(s => fetch(`/api/tasks?id=${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_next_action: false }),
    })));
    const res = await fetch(`/api/tasks?id=${task.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_next_action: !wasSet }),
    });
    if (res.ok) {
      const updated: Task = await res.json();
      setTasks(ts => ts.map(t => {
        if (t.id === updated.id) return updated;
        if (siblings.some(s => s.id === t.id)) return { ...t, is_next_action: false };
        return t;
      }));
    }
  }, [tasks]);

  const patchProject = useCallback(async (id: string, updates: Partial<Project>) => {
    const res = await fetch(`/api/projects?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated: Project = await res.json();
      setProjects(ps => ps.map(p => p.id === id ? { ...p, ...updated } : p));
      setSelectedProject(sp => sp?.id === id ? { ...sp, ...updated } : sp);
    }
  }, []);

  // 次の一手タスクを完了させたら「次の一手は？」を尋ねて新タスクを作る（板が育つエンジン）
  const markDoneWithNextAction = useCallback(async (task: Task) => {
    await markDone(task.id);
    if (task.is_next_action && task.project_id) {
      const next = window.prompt('次の一手は？（空欄でスキップ）');
      if (next && next.trim()) {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: next.trim(), status: 'today', priority: 'medium', assignee: 'yuuki',
            source: 'manual', project_id: task.project_id, is_next_action: true,
          }),
        });
        if (res.ok) {
          const created: Task = await res.json();
          setTasks(ts => [created, ...ts]);
        }
      }
    }
  }, [markDone]);

  const addProjectLog = useCallback(async (projectId: string, content: string) => {
    if (!content.trim()) return;
    const jstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const res = await fetch('/api/project-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, content: content.trim(), log_date: jstDate, entry_type: newLogType }),
    });
    if (res.ok) {
      const newLog = await res.json();
      setProjects(ps => ps.map(p => p.id === projectId
        ? { ...p, logs: [newLog, ...(p.logs ?? [])] }
        : p
      ));
      setSelectedProject(sp => sp?.id === projectId
        ? { ...sp, logs: [newLog, ...(sp.logs ?? [])] }
        : sp
      );
    }
  }, []);

  const addTask = async () => {
    if (!newTitle.trim()) return;
    const body: Partial<Task> = {
      title: newTitle.trim(),
      status: newDest === 'someday' ? 'someday' as TaskStatus : 'today' as TaskStatus,
      priority: newPriority,
      assignee: 'yuuki',
      source: 'manual' as TaskSource,
      ...(newDest === 'due' && newDueDate ? { due_date: newDueDate } : {}),
      ...(newProjectId ? { project_id: newProjectId } : {}),
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
    setNewDest('today');
    setNewDueDate('');
    setNewProjectId('');
    setShowAdd(false);
  };

  const tabConfig: { key: 'today' | 'upcoming' | 'someday'; icon: string; label: string; count: number }[] = [
    { key: 'today', icon: '📋', label: '今日やる', count: today.length },
    { key: 'upcoming', icon: '⏰', label: '期限あり', count: upcoming.length },
    { key: 'someday', icon: '📦', label: 'いつかやる', count: someday.length },
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
              <button onClick={() => { setShowAdd(false); setNewDest('today'); setNewDueDate(''); setNewProjectId(''); }} className="text-xs px-3 py-1.5 text-stone-400 hover:text-stone-200">キャンセル</button>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setNewDest(d => d === 'today' ? 'due' : d === 'due' ? 'someday' : 'today')}
                className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                  newDest === 'today' ? 'border-green-600 text-green-400 bg-green-900/20' :
                  newDest === 'due' ? 'border-blue-500 text-blue-400 bg-blue-900/20' :
                  'border-stone-600 text-stone-500 hover:border-stone-400 hover:text-stone-300'
                }`}
              >
                {newDest === 'today' ? '📋 今日やる' : newDest === 'due' ? '⏰ 期限あり' : '📦 いつか'}
              </button>
              {newDest === 'due' && (
                <input
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                  className="text-xs border border-stone-600 rounded px-2 py-1.5 bg-stone-700 text-stone-200 outline-none focus:border-blue-500"
                />
              )}
              <select
                value={newProjectId}
                onChange={e => setNewProjectId(e.target.value)}
                className={`text-xs border rounded px-2 py-1.5 bg-stone-700 ${newProjectId ? 'border-stone-400 text-stone-100' : 'border-stone-600 text-stone-400'}`}
              >
                <option value="">プロジェクトなし</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.no != null ? `No.${p.no} ` : ''}{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-44 flex-shrink-0 border-r border-stone-700 bg-stone-800 min-h-screen pt-4 hidden md:block">
          <div
            onClick={() => setActiveNav('tasks')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm cursor-pointer ${activeNav === 'tasks' ? 'text-stone-100 bg-stone-700' : 'text-stone-400 hover:bg-stone-700'}`}
          >
            📋 タスク
          </div>
          <div
            onClick={() => setActiveNav('projects')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm cursor-pointer ${activeNav === 'projects' ? 'text-stone-100 bg-stone-700' : 'text-stone-400 hover:bg-stone-700'}`}
          >
            🗂 プロジェクト
            {projects.filter(p => p.status === 'focus').length > 0 && (
              <span className="ml-auto text-xs bg-stone-700 text-stone-400 px-1.5 py-0.5 rounded-full">
                {projects.filter(p => p.status === 'focus').length}
              </span>
            )}
          </div>
          {activeNav === 'tasks' && (
            <>
              <div className="border-t border-stone-700 mt-2 pt-2">
                {([
                  ['today', '今日のタスク', today.length],
                  ['waiting', '返信待ち', waiting.length],
                  ['in_progress', '進行中', inProgress.length],
                  ['upcoming', '期限あり', upcoming.length],
                  ['someday', 'いつかやる', someday.length],
                ] as [string, string, number][]).map(([k, label, count]) => (
                  <div key={k} className="flex items-center justify-between px-4 py-2 text-xs text-stone-500 hover:bg-stone-700 cursor-pointer">
                    <span>{label}</span>
                    {count > 0 && <span className="bg-stone-700 text-stone-400 px-1.5 py-0.5 rounded-full">{count}</span>}
                  </div>
                ))}
              </div>
              <div className="border-t border-stone-700 mt-2 pt-2">
                <div className="px-4 py-2.5 text-sm text-stone-400 hover:bg-stone-700 cursor-pointer">📅 カレンダー</div>
              </div>
            </>
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 p-6 max-w-3xl">
          {loading ? (
            <p className="text-sm text-stone-600 text-center py-12">読み込み中...</p>
          ) : activeNav === 'projects' ? (
            <>
              {selectedProject ? (
                <>
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <button
                      onClick={() => { setSelectedProject(null); setShowLogForm(false); setShowAllLogs(false); setShowAllDone(false); }}
                      className="text-xs text-stone-500 hover:text-stone-300 transition-colors"
                    >
                      ← 一覧に戻る
                    </button>
                    <button
                      onClick={() => { setNewProjectId(selectedProject.id); setShowAdd(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      className="text-xs px-3 py-1.5 border border-stone-600 text-stone-300 rounded hover:border-stone-400 hover:text-stone-100 transition-colors"
                    >
                      + このプロジェクトのタスク
                    </button>
                  </div>

                  {/* ヘッダー */}
                  <div className="border border-stone-700 rounded-lg p-5 mb-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h2 className="text-base font-semibold text-stone-100">
                        {selectedProject.no != null && <span className="text-stone-500 mr-1.5">No.{selectedProject.no}</span>}
                        {selectedProject.name}
                        {selectedProject.kind === 'routine' && <span className="ml-2 text-xs text-stone-500 border border-stone-600 rounded px-1 align-middle">常設</span>}
                      </h2>
                      <select
                        value={selectedProject.status}
                        onChange={e => patchProject(selectedProject.id, { status: e.target.value as ProjectStatus })}
                        disabled={selectedProject.status === 'done'}
                        className={`text-xs font-medium flex-shrink-0 bg-stone-900 border border-stone-700 rounded px-2 py-1 ${PROJECT_STATUS_COLOR[selectedProject.status]}`}
                      >
                        {(['focus', 'scheduled', 'waiting', 'seed', 'done'] as ProjectStatus[]).map(s => (
                          <option key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </div>

                    {/* 概要 */}
                    {selectedProject.summary && (
                      <p className="text-sm text-stone-300 mb-3 leading-relaxed">{selectedProject.summary}</p>
                    )}

                    {/* メタ */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500 mb-2">
                      {selectedProject.category && <span>カテゴリ: {selectedProject.category}</span>}
                      {selectedProject.assignees.length > 0 && (
                        <span>担当: {selectedProject.assignees.join(', ')}{selectedProject.assignee_role ? ` (${selectedProject.assignee_role})` : ''}</span>
                      )}
                      {selectedProject.due_date && <span>期限: {selectedProject.due_date}</span>}
                      <button
                        onClick={() => patchProject(selectedProject.id, { kind: selectedProject.kind === 'routine' ? 'project' : 'routine' })}
                        className="text-stone-500 hover:text-stone-300 underline decoration-dotted transition-colors"
                      >
                        {selectedProject.kind === 'routine' ? '常設運用を解除' : '常設運用にする'}
                      </button>
                      {selectedProject.status === 'waiting' && (
                        <span className="flex items-center gap-1">
                          フォロー予定日:
                          <input
                            type="date"
                            value={selectedProject.follow_up_date ?? ''}
                            onChange={e => patchProject(selectedProject.id, { follow_up_date: e.target.value || null })}
                            className="bg-stone-900 border border-stone-700 rounded px-1 py-0.5 text-stone-300"
                          />
                        </span>
                      )}
                    </div>

                    {/* NA・ブロッカー */}
                    {selectedProject.next_action && (
                      <p className="text-sm text-stone-300 mt-3 border-l-2 border-stone-600 pl-3">→ {selectedProject.next_action}</p>
                    )}
                    {selectedProject.blocker_type && selectedProject.blocker_type !== 'none' && (
                      <p className="text-xs text-red-400 mt-2">⚠ ブロッカー: {selectedProject.blocker_detail ?? selectedProject.blocker_type}</p>
                    )}

                    {/* 完了候補・完了 */}
                    {selectedProject.status !== 'done' && (
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-stone-800">
                        <button
                          onClick={() => patchProject(selectedProject.id, { done_candidate: !selectedProject.done_candidate })}
                          className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                            selectedProject.done_candidate
                              ? 'border-emerald-600 text-emerald-400 bg-emerald-900/20'
                              : 'border-stone-600 text-stone-500 hover:border-stone-400'
                          }`}
                        >
                          🏁 {selectedProject.done_candidate ? '完了候補（チーム提案中）' : '完了候補にする'}
                        </button>
                        <span className="text-xs text-stone-600">完了ボタンは祐紀さんが押す運用です</span>
                        <button
                          onClick={() => { if (window.confirm(`「${selectedProject.name}」を完了にしますか？`)) patchProject(selectedProject.id, { status: 'done', done_candidate: false }); }}
                          className="ml-auto text-xs px-2.5 py-1 rounded border border-stone-600 text-stone-300 hover:border-emerald-500 hover:text-emerald-400 transition-colors"
                        >
                          ✓ 完了にする
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 相談カテゴリ専用パネル（旧consultationsツールの安全機能を移植） */}
                  {selectedProject.category === '相談' && (
                    <section className={`mb-5 p-4 rounded-lg border ${selectedProject.danger_flag && !selectedProject.danger_ack ? 'border-red-600 bg-red-950' : 'border-stone-700'}`}>
                      {selectedProject.danger_flag && (
                        <div className="mb-3">
                          <p className={`text-sm font-medium ${selectedProject.danger_ack ? 'text-stone-400' : 'text-red-300'}`}>
                            ⚠️ 危険フラグ: {selectedProject.danger_ack ? '確認済み' : 'ON（未確認）'}
                          </p>
                          {selectedProject.danger_note && <p className="text-xs text-stone-500 mt-1">{selectedProject.danger_note}</p>}
                          <div className="flex gap-2 mt-2">
                            {!selectedProject.danger_ack && (
                              <button
                                onClick={() => patchProject(selectedProject.id, { danger_ack: true })}
                                className="text-xs px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-white"
                              >
                                確認済みにする
                              </button>
                            )}
                            <button
                              onClick={() => patchProject(selectedProject.id, { danger_flag: false })}
                              className="text-xs px-2 py-1 rounded bg-stone-700 hover:bg-stone-600 text-stone-300"
                            >
                              フラグ解除
                            </button>
                          </div>
                        </div>
                      )}
                      {!selectedProject.danger_flag && (
                        <button
                          onClick={() => patchProject(selectedProject.id, { danger_flag: true, danger_note: '手動フラグ' })}
                          className="mb-3 text-xs px-2 py-1 rounded border border-red-700 text-red-400 hover:bg-red-950"
                        >
                          ⚠️ 危険フラグを立てる
                        </button>
                      )}
                      <div className="mb-3">
                        <p className="text-xs text-stone-500 mb-1">相談内容</p>
                        <div className="text-sm text-stone-200 bg-stone-900 rounded p-3 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                          {selectedProject.content || '（未入力）'}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-stone-500 mb-1">返信文</p>
                        <textarea
                          defaultValue={selectedProject.reply_draft ?? ''}
                          onBlur={e => { if (e.target.value !== (selectedProject.reply_draft ?? '')) patchProject(selectedProject.id, { reply_draft: e.target.value }); }}
                          className="w-full text-sm bg-stone-900 border border-stone-700 rounded p-3 text-stone-200 min-h-24"
                          placeholder="返信文をここに書く"
                        />
                      </div>
                    </section>
                  )}

                  {/* 次の一手（focusレーンの心臓部） */}
                  {selectedProject.status === 'focus' && (
                    <section className="mb-5">
                      <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center">
                        ▶ 次の一手
                        <HelpTip text="このプロジェクトで次に手を動かすタスクです。完了すると「次の一手は？」と聞かれ、続きを登録できます。focusは常にこれを1つ持つのが理想です。" />
                      </h3>
                      {(() => {
                        const nextActionTasks = tasks.filter(t => t.project_id === selectedProject.id && t.is_next_action);
                        return nextActionTasks.length === 0 ? (
                          <p className="text-sm text-stone-600 py-2">次の一手が未設定です。下の「+このプロジェクトのタスク」で追加し、一覧で編集して「次の一手」に指定してください。</p>
                        ) : (
                          nextActionTasks.map(t => (
                            <TaskRow key={t.id} task={t} onDone={() => markDoneWithNextAction(t)} onStart={markStarted} onEdit={editTask} onDelete={deleteTask} onSetNextAction={setNextAction} />
                          ))
                        );
                      })()}
                    </section>
                  )}

                  {/* 流れ */}
                  <section className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center">
                        流れ
                        <HelpTip text="プロジェクトの進捗ログ。「+ 記録」ボタンで追記できます。「🎯 済み」は完了マイルストーンとして緑色で強調表示されます。" />
                      </h3>
                      <button
                        onClick={() => { setShowLogForm(v => !v); setNewLogContent(''); }}
                        className="text-xs text-stone-600 hover:text-stone-300 transition-colors"
                      >
                        + 記録
                      </button>
                    </div>
                    {showLogForm && (
                      <div className="flex flex-col gap-2 mb-3">
                        <div className="flex gap-2">
                          <input
                            autoFocus
                            value={newLogContent}
                            onChange={e => setNewLogContent(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && e.shiftKey) {
                                addProjectLog(selectedProject.id, newLogContent);
                                setNewLogContent('');
                                setShowLogForm(false);
                              }
                              if (e.key === 'Escape') { setShowLogForm(false); setNewLogContent(''); setNewLogType('progress'); }
                            }}
                            placeholder="進捗・メモ… (Shift+Enterで記録)"
                            className="flex-1 text-sm border border-stone-600 rounded px-3 py-1.5 bg-stone-700 text-stone-100 placeholder-stone-500 outline-none focus:border-stone-400"
                          />
                          <button
                            onClick={() => { addProjectLog(selectedProject.id, newLogContent); setNewLogContent(''); setNewLogType('progress'); setShowLogForm(false); }}
                            className="text-xs px-3 py-1.5 bg-stone-100 text-stone-900 rounded hover:bg-white flex-shrink-0"
                          >記録</button>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setNewLogType('progress')}
                            className={`text-xs px-2.5 py-1 rounded border transition-colors ${newLogType === 'progress' ? 'border-blue-600 text-blue-400 bg-blue-900/20' : 'border-stone-600 text-stone-500 hover:border-stone-400'}`}
                          >進捗</button>
                          <button
                            onClick={() => setNewLogType('milestone_done')}
                            className={`text-xs px-2.5 py-1 rounded border transition-colors ${newLogType === 'milestone_done' ? 'border-green-600 text-green-400 bg-green-900/20' : 'border-stone-600 text-stone-500 hover:border-stone-400'}`}
                          >🎯 済み</button>
                        </div>
                      </div>
                    )}
                    {(selectedProject.logs?.length ?? 0) === 0 ? (
                      <p className="text-sm text-stone-600 py-3 text-center">ログなし</p>
                    ) : (
                      <>
                        {(showAllLogs ? selectedProject.logs! : selectedProject.logs!.slice(0, 5)).map(log => (
                          <div key={log.id} className={`flex gap-3 py-2 border-b border-stone-800 ${log.entry_type === 'milestone_done' ? 'bg-green-950/20' : ''}`}>
                            <span className="text-xs text-stone-600 flex-shrink-0 tabular-nums w-16">{log.log_date}</span>
                            <p className={`text-sm leading-snug flex-1 min-w-0 ${log.entry_type === 'milestone_done' ? 'text-green-300' : 'text-stone-300'}`}>
                              {log.entry_type === 'milestone_done' && <span className="mr-1">🎯</span>}{log.content}
                            </p>
                            {log.source && <span className="text-xs text-stone-600 flex-shrink-0">{log.source}</span>}
                          </div>
                        ))}
                        {(selectedProject.logs?.length ?? 0) > 5 && (
                          <button
                            onClick={() => setShowAllLogs(v => !v)}
                            className="text-xs text-stone-600 hover:text-stone-400 mt-2 transition-colors"
                          >
                            {showAllLogs ? '▲ 最新5件に戻す' : `▲ 全${selectedProject.logs!.length}件を見る（古い履歴を展開）`}
                          </button>
                        )}
                      </>
                    )}
                  </section>

                  {/* 済み */}
                  {(selectedProject.done_tasks?.length ?? 0) > 0 && (
                    <section className="mb-5">
                      <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center">
                      済み
                      <HelpTip text="このプロジェクトに紐づく完了タスクの一覧です。" />
                    </h3>
                      {(showAllDone ? selectedProject.done_tasks! : selectedProject.done_tasks!.slice(0, 5)).map(t => (
                        <div key={t.id} className="flex items-center gap-2 py-2 border-b border-stone-800">
                          <span className="text-green-700 text-xs flex-shrink-0">✓</span>
                          <p className="text-sm text-stone-500 line-through truncate flex-1 min-w-0">{t.title}</p>
                          {t.completed_at && (
                            <span className="text-xs text-stone-700 flex-shrink-0 ml-auto">
                              {new Date(t.completed_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      ))}
                      {(selectedProject.done_tasks?.length ?? 0) > 5 && (
                        <button
                          onClick={() => setShowAllDone(v => !v)}
                          className="text-xs text-stone-600 hover:text-stone-400 mt-2 transition-colors"
                        >
                          {showAllDone ? '▲ 折りたたむ' : `▼ 全${selectedProject.done_tasks!.length}件を見る`}
                        </button>
                      )}
                    </section>
                  )}

                  {/* 関連タスク */}
                  <section>
                    <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3 flex items-center">
                      関連タスク
                      <HelpTip text="このプロジェクトに紐づく未完了タスク（今日やる・進行中・返信待ち・期限あり）です。完了済みは上の「済み」に移ります。" />
                    </h3>
                    {relatedTasks.length === 0
                      ? <p className="text-sm text-stone-600 py-4 text-center">なし</p>
                      : relatedTasks.map(t => <TaskRow key={t.id} task={t} onDone={t.is_next_action ? () => markDoneWithNextAction(t) : markDone} onStart={markStarted} onEdit={editTask} onDelete={deleteTask} onSetNextAction={setNextAction} />)
                    }
                  </section>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-sm font-semibold text-stone-300">プロジェクト一覧</h2>
                    <span className="text-xs text-stone-600">{projects.length} 件</span>
                  </div>
                  {projects.length === 0
                    ? <p className="text-sm text-stone-600 py-8 text-center">プロジェクトなし</p>
                    : (() => {
                        const soudanProjects = projects.filter(p => p.category === '相談')
                          .sort((a, b) => {
                            const aOpen = a.danger_flag && !a.danger_ack ? 0 : 1;
                            const bOpen = b.danger_flag && !b.danger_ack ? 0 : 1;
                            if (aOpen !== bOpen) return aOpen - bOpen;
                            return (b.activity_date ?? '') < (a.activity_date ?? '') ? -1 : 1;
                          });
                        const activeProjects = projects.filter(p => p.category !== '相談' && p.kind !== 'routine' && p.status !== 'done');
                        const routineProjects = projects.filter(p => p.category !== '相談' && p.kind === 'routine' && p.status !== 'done');
                        const doneProjects = projects.filter(p => p.category !== '相談' && p.status === 'done');
                        const focusGroup = activeProjects.filter(p => p.status === 'focus')
                          .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));
                        const scheduledGroup = activeProjects.filter(p => p.status === 'scheduled')
                          .sort((a, b) => (a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : 1);
                        const waitingGroup = activeProjects.filter(p => p.status === 'waiting')
                          .sort((a, b) => (a.follow_up_date ?? '9999') < (b.follow_up_date ?? '9999') ? -1 : 1);
                        const seedGroup = activeProjects.filter(p => p.status === 'seed')
                          .sort((a, b) => (b.activity_date ?? '') < (a.activity_date ?? '') ? -1 : 1);
                        return (
                          <div className="flex flex-col gap-6">
                            {soudanProjects.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-pink-400">
                                  💬 相談 ({soudanProjects.length})
                                  {soudanProjects.some(p => p.danger_flag && !p.danger_ack) && (
                                    <span className="ml-2 text-red-400">🔴 要確認 {soudanProjects.filter(p => p.danger_flag && !p.danger_ack).length}件</span>
                                  )}
                                </p>
                                <div className="flex flex-col gap-2">
                                  {soudanProjects.map(p => <ProjectCard key={p.id} project={p} onClick={() => setSelectedProject(p)} />)}
                                </div>
                              </div>
                            )}
                            {focusGroup.length > 0 && (
                              <div>
                                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${PROJECT_STATUS_COLOR.focus}`}>
                                  {PROJECT_STATUS_LABEL.focus} ({focusGroup.length})
                                  {focusGroup.length > FOCUS_SOFT_LIMIT && (
                                    <span className="ml-2 text-stone-500 normal-case font-normal">
                                      {focusGroup.length}件＝全部は進みにくいかも
                                    </span>
                                  )}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {focusGroup.map(p => <ProjectCard key={p.id} project={p} onClick={() => setSelectedProject(p)} />)}
                                </div>
                              </div>
                            )}
                            {scheduledGroup.length > 0 && (
                              <div>
                                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${PROJECT_STATUS_COLOR.scheduled}`}>
                                  {PROJECT_STATUS_LABEL.scheduled} ({scheduledGroup.length})
                                </p>
                                <div className="flex flex-col gap-2">
                                  {scheduledGroup.map(p => <ProjectCard key={p.id} project={p} onClick={() => setSelectedProject(p)} />)}
                                </div>
                              </div>
                            )}
                            {waitingGroup.length > 0 && (
                              <div>
                                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${PROJECT_STATUS_COLOR.waiting}`}>
                                  {PROJECT_STATUS_LABEL.waiting} ({waitingGroup.length})
                                </p>
                                <div className="flex flex-col gap-2">
                                  {waitingGroup.map(p => <ProjectCard key={p.id} project={p} onClick={() => setSelectedProject(p)} />)}
                                </div>
                              </div>
                            )}
                            {seedGroup.length > 0 && (
                              <div>
                                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${PROJECT_STATUS_COLOR.seed}`}>
                                  {PROJECT_STATUS_LABEL.seed} ({seedGroup.length})
                                </p>
                                <div className="flex flex-col gap-2">
                                  {seedGroup.map(p => <ProjectCard key={p.id} project={p} onClick={() => setSelectedProject(p)} />)}
                                </div>
                              </div>
                            )}
                            {routineProjects.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-stone-500">
                                  ⚙️ 常設運用 ({routineProjects.length})
                                </p>
                                <div className="flex flex-col gap-2">
                                  {routineProjects.map(p => <ProjectCard key={p.id} project={p} onClick={() => setSelectedProject(p)} />)}
                                </div>
                              </div>
                            )}
                            {doneProjects.length > 0 && (
                              <div>
                                <button
                                  onClick={() => setShowDoneProjects(v => !v)}
                                  className={`text-xs font-semibold uppercase tracking-wider mb-2 ${PROJECT_STATUS_COLOR.done} hover:text-stone-300 transition-colors`}
                                >
                                  {showDoneProjects ? '▲' : '▼'} {PROJECT_STATUS_LABEL.done} ({doneProjects.length})
                                </button>
                                {showDoneProjects && (
                                  <div className="flex flex-col gap-2">
                                    {doneProjects.map(p => <ProjectCard key={p.id} project={p} onClick={() => setSelectedProject(p)} />)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()
                  }
                </>
              )}
            </>
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

              {/* 進行中 */}
              {inProgress.length > 0 && (
                <section className="mb-8">
                  <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                    ⚙️ 進行中
                    <span className="ml-2 text-stone-600 font-normal normal-case">({inProgress.length})</span>
                  </h2>
                  {inProgress.map(t => <TaskRow key={t.id} task={t} onDone={t.is_next_action ? () => markDoneWithNextAction(t) : markDone} onStart={markStarted} onEdit={editTask} onDelete={deleteTask} project={t.project_id ? projectsById.get(t.project_id) : undefined} onOpenProject={openProject} onSetNextAction={setNextAction} />)}
                </section>
              )}

              {/* タブコンテンツ */}
              <section className="mb-8">
                {activeTab === 'today' && (
                  today.length === 0
                    ? <p className="text-sm text-stone-600 py-4 text-center">タスクなし</p>
                    : today.map(t => <TaskRow key={t.id} task={t} onDone={t.is_next_action ? () => markDoneWithNextAction(t) : markDone} onStart={markStarted} onEdit={editTask} onDelete={deleteTask} project={t.project_id ? projectsById.get(t.project_id) : undefined} onOpenProject={openProject} onSetNextAction={setNextAction} />)
                )}
                {activeTab === 'upcoming' && (
                  upcoming.length === 0
                    ? <p className="text-sm text-stone-600 py-4 text-center">締切のタスクなし</p>
                    : upcoming.map(t => <TaskRow key={t.id} task={t} onDone={t.is_next_action ? () => markDoneWithNextAction(t) : markDone} onStart={markStarted} onEdit={editTask} onDelete={deleteTask} onMarkToday={markToday} project={t.project_id ? projectsById.get(t.project_id) : undefined} onOpenProject={openProject} onSetNextAction={setNextAction} />)
                )}
                {activeTab === 'someday' && (
                  someday.length === 0
                    ? <p className="text-sm text-stone-600 py-4 text-center">タスクなし</p>
                    : someday.map(t => <TaskRow key={t.id} task={t} onDone={t.is_next_action ? () => markDoneWithNextAction(t) : markDone} onStart={markStarted} onEdit={editTask} onDelete={deleteTask} onMarkToday={markToday} project={t.project_id ? projectsById.get(t.project_id) : undefined} onOpenProject={openProject} onSetNextAction={setNextAction} />)
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
                  : waiting.map(t => <TaskRow key={t.id} task={t} onDone={t.is_next_action ? () => markDoneWithNextAction(t) : markDone} onStart={markStarted} onEdit={editTask} onDelete={deleteTask} project={t.project_id ? projectsById.get(t.project_id) : undefined} onOpenProject={openProject} onSetNextAction={setNextAction} />)
                }
              </section>

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
                    <div key={t.id} className="flex items-center gap-3 py-2 border-b border-stone-700 opacity-40 hover:opacity-70 transition-opacity group/done">
                      <button
                        onClick={() => markUndone(t.id)}
                        className="w-5 h-5 rounded-full border-2 border-green-700 hover:border-stone-500 hover:bg-stone-800 flex items-center justify-center flex-shrink-0 transition-all group/undone"
                        title="完了を取り消す（今日やるに戻す）"
                      >
                        <span className="text-green-500 group-hover/undone:text-stone-400 text-xs leading-none transition-colors">✓</span>
                      </button>
                      <p className="text-sm text-stone-400 line-through truncate">{t.title}</p>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </main>
      </div>
      {selectedReel && (
        <ReelDetailPanel
          reel={selectedReel}
          onClose={() => setSelectedReel(null)}
        />
      )}
    </div>
  );
}
