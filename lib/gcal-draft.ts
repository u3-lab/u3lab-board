import { google } from 'googleapis';
import type { Task } from '@/lib/types';

const DRAFT_CALENDAR_NAME = '02行動_下書き';
const DRAFT_CALENDAR_SHARE_WITH = 'hrd.yuk@gmail.com';

export function getGcalAuth() {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');
  const credentials = JSON.parse(credJson);
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
}

// 新規作成したカレンダーはサービスアカウント自身の中にしか存在しないため、
// 祐紀さんのアカウントへ共有しないと永遠に見えない（2026-07-06 発見・修正）。
// 既存カレンダーに対しても毎回呼ぶ（過去に孤立作成された分も含めて冪等に共有し直す）。
// 既に共有済みの場合 acl.insert は 409 を返すので握り潰す。
async function ensureShared(
  calendar: ReturnType<typeof google.calendar>,
  calendarId: string
): Promise<void> {
  try {
    await calendar.acl.insert({
      calendarId,
      requestBody: {
        role: 'writer',
        scope: { type: 'user', value: DRAFT_CALENDAR_SHARE_WITH },
      },
    });
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code;
    if (code !== 409) throw e;
  }

  // 新規作成直後はデフォルトTZがUTCになるため Asia/Tokyo に揃える（実害は無いが表示が素直になる）
  await calendar.calendars.patch({
    calendarId,
    requestBody: { timeZone: 'Asia/Tokyo' },
  });
}

export async function getOrCreateDraftCalendarId(auth: ReturnType<typeof getGcalAuth>): Promise<string> {
  const calendar = google.calendar({ version: 'v3', auth });
  const list = await calendar.calendarList.list();
  const existing = list.data.items?.find(c => c.summary === DRAFT_CALENDAR_NAME);
  if (existing?.id) {
    await ensureShared(calendar, existing.id);
    return existing.id;
  }

  const created = await calendar.calendars.insert({
    requestBody: { summary: DRAFT_CALENDAR_NAME },
  });
  const calendarId = created.data.id!;
  await ensureShared(calendar, calendarId);

  return calendarId;
}

// 1タスク分を下書きカレンダーへ書き込み、作成したイベントIDを返す。
// イベント駆動フック（PATCH /api/tasks）・日次バックアップバッチの両方から呼ばれる共通ロジック。
export async function writeTaskToDraftCalendar(task: Task): Promise<string | null> {
  const auth = getGcalAuth();
  const calendarId = await getOrCreateDraftCalendarId(auth);
  const calendar = google.calendar({ version: 'v3', auth });

  const completedAt = task.completed_at ? new Date(task.completed_at) : new Date();
  const startedAt = task.started_at
    ? new Date(task.started_at)
    : new Date(completedAt.getTime() - 30 * 60 * 1000);

  const estimated = !task.started_at;
  const sourceLabel = task.source === 'webhook_line' ? 'LINE'
    : task.source === 'webhook_slack' ? 'Slack'
    : task.source === 'manual' ? '手動'
    : task.source;

  const descParts: string[] = [];
  if (estimated) descParts.push('⚠️開始時刻未取得（推定）');
  if (task.memo) descParts.push(task.memo);
  descParts.push(`source: ${sourceLabel}`);
  if (task.category) descParts.push(`category: ${task.category}`);

  const event = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: task.title,
      description: descParts.join('\n'),
      start: { dateTime: startedAt.toISOString(), timeZone: 'Asia/Tokyo' },
      end: { dateTime: completedAt.toISOString(), timeZone: 'Asia/Tokyo' },
    },
  });

  return event.data.id ?? null;
}

// 完了取り消し(undo)・タスク削除時に対応するカレンダーイベントを削除する。
// 既に消えている(404/410)場合は冪等に無視する。
export async function deleteDraftCalendarEvent(gcalEventId: string): Promise<void> {
  const auth = getGcalAuth();
  const calendarId = await getOrCreateDraftCalendarId(auth);
  const calendar = google.calendar({ version: 'v3', auth });
  try {
    await calendar.events.delete({ calendarId, eventId: gcalEventId });
  } catch (e: unknown) {
    const code = (e as { code?: number })?.code;
    if (code !== 404 && code !== 410) throw e;
  }
}
