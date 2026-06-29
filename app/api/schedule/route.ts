import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export interface ScheduleEvent {
  id: string;
  title: string;
  start: string;    // HH:MM in JST, or "終日"
  end?: string;     // HH:MM in JST
  allDay: boolean;
  calendarLabel?: string;
}

const CALENDAR_IDS = (process.env.GCAL_CALENDAR_IDS ?? 'primary').split(',').map(s => s.trim());

function toJSTTime(iso: string): string {
  const d = new Date(iso);
  const jst = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${String(jst.getUTCHours()).padStart(2, '0')}:${String(jst.getUTCMinutes()).padStart(2, '0')}`;
}

// GET /api/schedule — returns today's events from Google Calendar
export async function GET() {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) {
    return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON not configured' }, { status: 503 });
  }

  try {
    const credentials = JSON.parse(credJson);
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    const calendar = google.calendar({ version: 'v3', auth });

    const jstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    const timeMin = new Date(`${jstDate}T00:00:00+09:00`).toISOString();
    const timeMax = new Date(`${jstDate}T23:59:59+09:00`).toISOString();

    const events: ScheduleEvent[] = [];

    for (const calendarId of CALENDAR_IDS) {
      const res = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 20,
      });

      for (const ev of res.data.items ?? []) {
        if (!ev.summary) continue;
        const isAllDay = !!ev.start?.date;
        events.push({
          id: ev.id ?? crypto.randomUUID(),
          title: ev.summary,
          start: isAllDay ? '終日' : toJSTTime(ev.start?.dateTime ?? ''),
          end: isAllDay ? undefined : toJSTTime(ev.end?.dateTime ?? ''),
          allDay: isAllDay,
          calendarLabel: ev.organizer?.displayName ?? undefined,
        });
      }
    }

    events.sort((a, b) => {
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return a.start < b.start ? -1 : 1;
    });

    return NextResponse.json(events);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
