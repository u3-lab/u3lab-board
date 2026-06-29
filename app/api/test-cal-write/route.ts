import { NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET() {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) return NextResponse.json({ error: 'GOOGLE_SERVICE_ACCOUNT_JSON not set' }, { status: 503 });

  try {
    const credentials = JSON.parse(credJson);
    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
    const calendar = google.calendar({ version: 'v3', auth });
    const now = new Date();
    const start = new Date(now.getTime() + 5 * 60 * 1000);
    const end = new Date(start.getTime() + 15 * 60 * 1000);

    const event = await calendar.events.insert({
      calendarId: 'hrd@me.com',
      requestBody: {
        summary: '【UTF-8確認】日本語テスト 完了→02行動',
        description: '⚠️開始時刻未取得（推定）\nsource: 手動\ncategory: other',
        start: { dateTime: start.toISOString(), timeZone: 'Asia/Tokyo' },
        end: { dateTime: end.toISOString(), timeZone: 'Asia/Tokyo' },
      },
    });

    return NextResponse.json({ ok: true, eventId: event.data.id, summary: event.data.summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
