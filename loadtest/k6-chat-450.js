// בדיקת עומס — 450 משתמשים במקביל (HTTP + Realtime של הצ'אט).
// הרצה:
//   k6 run -e SUPABASE_URL=... -e ANON_KEY=... -e LT_PASSWORD=... -e GROUP_ID=... loadtest/k6-chat-450.js
// התחברות רגילה (password) עם LOGIN_USERS משתמשי loadtest+N@darkpool.test — מתחת למגבלת ההתחברות לפי IP;
// ה-VUs חולקים אותם (עומס DB/RLS זהה). רק לקבוצת LOADTEST המוסתרת.
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const URL = __ENV.SUPABASE_URL;
const ANON = __ENV.ANON_KEY;
const PW = __ENV.LT_PASSWORD;
const GROUP = __ENV.GROUP_ID;
const LOGIN_USERS = Number(__ENV.LOGIN_USERS || 25);
const PEAK = Number(__ENV.PEAK || 450);

const rtLatency = new Trend('rt_message_latency_ms', true);
const rtJoinOk = new Rate('rt_join_ok');
const rtReceived = new Counter('rt_messages_received');
const sent = new Counter('chat_messages_sent');

const SMOKE = __ENV.SMOKE === '1';
const stages = SMOKE ? [{ duration: '20s', target: PEAK }, { duration: '40s', target: PEAK }, { duration: '10s', target: 0 }] : [
  { duration: '1m', target: 50 },
  { duration: '2m', target: 200 },
  { duration: '2m', target: PEAK },
  { duration: '5m', target: PEAK },
  { duration: '1m', target: 0 },
];

export const options = {
  setupTimeout: '3m',
  scenarios: {
    browse: { executor: 'ramping-vus', exec: 'browse', startVUs: 0, stages, gracefulRampDown: '20s' },
    realtime: { executor: 'ramping-vus', exec: 'realtime', startVUs: 0, stages, gracefulRampDown: '20s' },
    // הודעה כל 5 שניות לקבוצה — מודדים כמה זמן לוקח לה להגיע לכל המחוברים
    sender: {
      executor: 'constant-arrival-rate', exec: 'sender', rate: 1, timeUnit: '5s',
      duration: SMOKE ? '50s' : '9m', startTime: SMOKE ? '15s' : '1m', preAllocatedVUs: 2,
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' }],
    'http_req_duration{kind:read}': ['p(95)<800'],
    rt_join_ok: ['rate>0.98'],
    rt_message_latency_ms: ['p(95)<2000'],
  },
};

export function setup() {
  const users = [];
  for (let i = 1; i <= LOGIN_USERS; i++) {
    const r = http.post(
      `${URL}/auth/v1/token?grant_type=password`,
      JSON.stringify({ email: `loadtest+${i}@darkpool.test`, password: PW }),
      { headers: { apikey: ANON, 'Content-Type': 'application/json' }, tags: { kind: 'login' } },
    );
    if (r.status === 200) users.push({ id: r.json('user.id'), token: r.json('access_token') });
    else console.error(`login ${i} failed: ${r.status} ${r.body}`);
    sleep(0.5);
  }
  if (!users.length) throw new Error('no logins succeeded');
  return { users };
}

function me(data) {
  return data.users[(__VU - 1) % data.users.length];
}

function hdr(u) {
  return { headers: { apikey: ANON, Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' } };
}

function get(u, path, name) {
  const p = hdr(u);
  p.tags = { kind: 'read', name };
  const r = http.get(`${URL}/rest/v1/${path}`, p);
  check(r, { [`${name} 200`]: (x) => x.status === 200 });
  return r;
}

// «משתמש פותח את האפליקציה וגולש» — אותן שאילתות כמו המסכים
export function browse(data) {
  const u = me(data);
  const today = new Date().toISOString().slice(0, 10);
  get(u, `chat_group_members?select=group_id,unread_count,mentioned_count,is_muted&user_id=eq.${u.id}`, 'my_groups');
  get(u, 'chat_groups?select=*&order=last_message_at.desc.nullslast', 'groups');
  sleep(1 + Math.random() * 2);
  get(
    u,
    `chat_messages?select=*,sender:users!chat_messages_sender_id_fkey(id,display_name,profile_picture,is_online)` +
      `&group_id=eq.${GROUP}&or=(is_deleted.eq.false,deleted_for_everyone.eq.true)&order=created_at.desc&limit=50`,
    'messages',
  );
  sleep(2 + Math.random() * 3);
  get(u, 'app_news_clean?select=*&order=created_at.desc&limit=30', 'news');
  get(u, 'dark_pool_congress_trades?select=*&order=filed_at.desc&limit=50', 'congress');
  get(u, 'dark_pool_insider_buys?select=*&order=filed_at.desc&limit=50', 'insiders');
  sleep(2 + Math.random() * 3);
  get(u, `economic_events_cache?select=*&date=gte.${today}&order=date.asc&limit=100`, 'economic');
  get(u, `earnings_calendar?select=*&report_date=gte.${today}&order=report_date.asc&limit=100`, 'earnings');
  get(u, `user_stories?select=*&expires_at=gt.${new Date().toISOString()}&order=created_at.desc`, 'stories');
  sleep(3 + Math.random() * 4);
}

// מחובר לצ'אט: ערוץ פרטי chat-group:<id> (כמו האפליקציה), heartbeat, מחכה להודעות
export function realtime(data) {
  const u = me(data);
  const wsUrl = `${URL.replace('https://', 'wss://')}/realtime/v1/websocket?apikey=${ANON}&vsn=1.0.0`;
  const topic = `realtime:chat-group:${GROUP}`;
  let joined = false;
  ws.connect(wsUrl, { tags: { kind: 'rt' } }, (socket) => {
    let ref = 1;
    socket.on('open', () => {
      socket.send(JSON.stringify({
        topic, event: 'phx_join', ref: String(ref), join_ref: String(ref),
        payload: { config: { broadcast: { ack: false, self: false }, presence: { key: '' }, private: true }, access_token: u.token },
      }));
      socket.setInterval(() => {
        ref += 1;
        socket.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(ref) }));
      }, 25000);
      socket.setTimeout(() => socket.close(), SMOKE ? 55000 : 120000 + Math.random() * 60000);
    });
    socket.on('message', (raw) => {
      const m = JSON.parse(raw);
      if (m.event === 'phx_reply' && m.ref === '1') {
        joined = m.payload && m.payload.status === 'ok';
        rtJoinOk.add(joined);
        if (!joined) { console.error(`join failed: ${raw}`); socket.close(); }
      } else if (m.event === 'broadcast' && m.payload && m.payload.event === 'message_insert') {
        const content = (m.payload.payload && m.payload.payload.content) || '';
        const hit = /lt-ts=(\d+)/.exec(content);
        if (hit) { rtLatency.add(Date.now() - Number(hit[1])); rtReceived.add(1); }
      }
    });
    socket.on('error', (e) => { if (!joined) rtJoinOk.add(false); console.error(`ws error: ${e.error()}`); });
  });
  sleep(1);
}

export function sender(data) {
  const u = data.users[0];
  const p = hdr(u);
  p.headers.Prefer = 'return=minimal';
  p.tags = { kind: 'write', name: 'send_message' };
  const r = http.post(
    `${URL}/rest/v1/chat_messages`,
    JSON.stringify({ group_id: GROUP, sender_id: u.id, content: `בדיקת עומס lt-ts=${Date.now()}`, message_type: 'text' }),
    p,
  );
  if (check(r, { 'send 201': (x) => x.status === 201 })) sent.add(1);
  else console.error(`send failed: ${r.status} ${r.body}`);
}
