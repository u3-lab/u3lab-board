import { google } from 'googleapis';
import type { Task } from './types';

const CALENDAR_ID = 'hrd@me.com';

function getAuth() {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');
  const credentials = JSON.parse(credJson);
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
}

export async function writeActionEvent(task: Task): Promise<string> {
  const completedAt = task.completed_at ? new Date(task.completed_at) : new Date();
  let startedAt: Date;
  let estimated = false;

  if (task.started_at) {
    startedAt = new Date(task.started_at);
  } else {
    startedAt = new Date(completedAt.getTime() - 30 * 60 * 1000);
    estimated = true;
  }

  const sourceLabel = task.source === 'webhook_line' ? 'LINE'
    : task.source === 'webhook_slack' ? 'Slack'
    : task.source === 'manual' ? '手動'
    : task.source;

  const descParts: string[] = [];
  if (estimated) descParts.push('⚠️開始時刻未取得（推定）');
  if (task.memo) descParts.push(task.memo);
  descParts.push(`source: ${sourceLabel}`);
  if (task.category) descParts.push(`category: ${task.category}`);

  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  const event = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: task.title,
      description: descParts.join('\n'),
      start: { dateTime: startedAt.toISOString(), timeZone: 'Asia/Tokyo' },
      end: { dateTime: completedAt.toISOString(), timeZone: 'Asia/Tokyo' },
    },
  });

  return event.data.id ?? '';
}
