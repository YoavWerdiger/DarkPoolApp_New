// בדיקת עומס ל-Grafana Cloud — עד 100 VUs (מגבלת המסלול החינמי), אבל עומס של אלפי משתמשים:
// • גלישה: קצב בקשות קבוע ועולה (בלי «זמן קריאה»), כל איטרציה = טעינת מסך (בקשות במקביל, כמו האפליקציה)
// • צ'אט חי: WebSocket אסינכרוני — כל VU מחזיק WS_PER_VU חיבורים (10×45 = 450)
// • הודעות: MSG_PER_SEC הודעות בשנייה מכותבים שונים לקבוצת LOADTEST המוסתרת
// הרצה: k6 cloud run -e SUPABASE_URL=... -e ANON_KEY=... -e LT_PASSWORD=... -e GROUP_ID=... loadtest/k6-cloud-stress.js
import http from 'k6/http';
import { WebSocket } from 'k6/websockets';
import { setInterval, setTimeout, clearInterval } from 'k6/timers';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const URL = __ENV.SUPABASE_URL;
const ANON = __ENV.ANON_KEY;
const PW = __ENV.LT_PASSWORD;
const GROUP = __ENV.GROUP_ID;
const SMOKE = __ENV.SMOKE === '1';
const LOGIN_USERS = Number(__ENV.LOGIN_USERS || (SMOKE ? 3 : 25));
const RT_VUS = Number(__ENV.RT_VUS || (SMOKE ? 1 : 10));
const WS_PER_VU = Number(__ENV.WS_PER_VU || (SMOKE ? 5 : 45));
// שיא «מסכים בשנייה» (כל מסך ≈ 2–3 בקשות). משתמש אמיתי טוען מסך כל ~5–10 שניות → 250/s ≈ 1,500–2,500 משתמשים
const PEAK_RATE = Number(__ENV.PEAK_RATE || (SMOKE ? 3 : 250));
const BROWSE_VUS = Number(__ENV.BROWSE_VUS || (SMOKE ? 5 : 80));
const MSG_PER_SEC = Number(__ENV.MSG_PER_SEC || (SMOKE ? 1 : 5));
const HOLD = SMOKE ? '1m' : '10m';

const rtLatency = new Trend('rt_message_latency_ms', true);
const rtJoinOk = new Rate('rt_join_ok');
const rtOpen = new Counter('rt_connections_opened');
const rtReceived = new Counter('rt_messages_received');
const sent = new Counter('chat_messages_sent');

const browseStages = SMOKE
  ? [{ duration: '50s', target: PEAK_RATE }, { duration: '10s', target: 0 }]
  : [
      { duration: '1m', target: Math.round(PEAK_RATE * 0.2) },
      { duration: '2m', target: Math.round(PEAK_RATE * 0.5) },
      { duration: '2m', target: PEAK_RATE },
      { duration: '2m', target: PEAK_RATE },
      // spike — קפיצה פתאומית ×1.5 (רגע של דוח חם / התראה שכולם פותחים)
      { duration: '15s', target: Math.round(PEAK_RATE * 1.5) },
      { duration: '1m45s', target: Math.round(PEAK_RATE * 1.5) },
      { duration: '1m', target: 0 },
    ];

export const options = {
  cloud: {
    name: `DarkPool ${SMOKE ? 'smoke' : 'stress'} (cloud)`,
    distribution: { frankfurt: { loadZone: 'amazon:de:frankfurt', percent: 100 } },
  },
  setupTimeout: '2m',
  discardResponseBodies: true,
  scenarios: {
    browse: {
      executor: 'ramping-arrival-rate', exec: 'browse', timeUnit: '1s', startRate: 1,
      preAllocatedVUs: Math.min(BROWSE_VUS, 40), maxVUs: BROWSE_VUS, stages: browseStages,
    },
    realtime: {
      executor: 'per-vu-iterations', exec: 'realtime', vus: RT_VUS, iterations: 1,
      maxDuration: SMOKE ? '1m30s' : '11m30s',
    },
    sender: {
      executor: 'constant-arrival-rate', exec: 'sender', rate: MSG_PER_SEC, timeUnit: '1s',
      duration: SMOKE ? '40s' : '9m', startTime: SMOKE ? '15s' : '1m',
      preAllocatedVUs: 3, maxVUs: 5,
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' }],
    'http_req_duration{kind:read}': ['p(95)<800'],
    rt_join_ok: ['rate>0.98'],
    rt_message_latency_ms: ['p(95)<2000'],
    // הקצב היעד הושג בפועל? (אם k6 לא הספיק — האיטרציות «נופלות» והעומס נמוך מהמתוכנן)
    dropped_iterations: ['count<50'],
    // לכל מסך בנפרד — שאילתה איטית לא תתחבא מאחורי הממוצע
    'http_req_duration{name:messages}': ['p(95)<800'],
    'http_req_duration{name:groups}': ['p(95)<800'],
    'http_req_duration{name:my_groups}': ['p(95)<800'],
    'http_req_duration{name:earnings}': ['p(95)<800'],
    'http_req_duration{name:insiders}': ['p(95)<800'],
    'http_req_duration{name:send_message}': ['p(95)<1000'],
  },
};

export function setup() {
  const users = [];
  for (let i = 1; i <= LOGIN_USERS; i++) {
    const r = http.post(
      `${URL}/auth/v1/token?grant_type=password`,
      JSON.stringify({ email: `loadtest+${i}@darkpool.test`, password: PW }),
      { headers: { apikey: ANON, 'Content-Type': 'application/json' }, tags: { kind: 'login' }, responseType: 'text' },
    );
    if (r.status === 200) users.push({ id: r.json('user.id'), token: r.json('access_token') });
    else console.error(`login ${i} failed: ${r.status} ${r.body}`);
    sleep(0.5);
  }
  if (!users.length) throw new Error('no logins succeeded');
  return { users };
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function params(u, name, kind = 'read') {
  return {
    headers: { apikey: ANON, Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip' },
    tags: { kind, name },
  };
}

function screens(u) {
  const today = new Date().toISOString().slice(0, 10);
  const R = `${URL}/rest/v1/`;
  return [
    [
      ['my_groups', `chat_group_members?select=group_id,unread_count,mentioned_count,is_muted&user_id=eq.${u.id}`],
      ['groups', 'chat_groups?select=*&order=last_message_at.desc.nullslast'],
    ],
    [
      ['messages', `chat_messages?select=*,sender:users!chat_messages_sender_id_fkey(id,display_name,profile_picture,is_online)` +
        `&group_id=eq.${GROUP}&or=(is_deleted.eq.false,deleted_for_everyone.eq.true)&order=created_at.desc&limit=50`],
    ],
    [
      ['news', 'app_news_clean?select=*&order=created_at.desc&limit=30'],
      ['congress', 'dark_pool_congress_trades?select=*&order=filed_at.desc&limit=50'],
      ['insiders', 'dark_pool_insider_buys?select=*&order=filed_at.desc&limit=50'],
    ],
    [
      ['economic', `economic_events_cache?select=*&date=gte.${today}&order=date.asc&limit=100`],
      ['earnings', `earnings_calendar?select=*&report_date=gte.${today}&order=report_date.asc&limit=100`],
      ['stories', `user_stories?select=*&expires_at=gt.${new Date().toISOString()}&order=created_at.desc`],
    ],
  ].map((s) => s.map(([name, path]) => ['GET', R + path, null, params(u, name)]));
}

// מסך אחד = כמה בקשות במקביל (כמו האפליקציה כשנכנסים למסך)
export function browse(data) {
  const u = pick(data.users);
  const reqs = pick(screens(u));
  const res = http.batch(reqs);
  res.forEach((r, i) => check(r, { [`${reqs[i][3].tags.name} 200`]: (x) => x.status === 200 }));
}

// VU אחד מחזיק WS_PER_VU חיבורים בו-זמנית לערוץ הפרטי של הקבוצה
export function realtime(data) {
  const wsUrl = `${URL.replace('https://', 'wss://')}/realtime/v1/websocket?apikey=${ANON}&vsn=1.0.0`;
  const topic = `realtime:chat-group:${GROUP}`;
  const holdMs = SMOKE ? 60000 : 600000;
  for (let n = 0; n < WS_PER_VU; n++) {
    // פריסה הדרגתית של פתיחת החיבורים (לא כולם באותה מילישנייה)
    setTimeout(() => {
      const u = data.users[(n + __VU * WS_PER_VU) % data.users.length];
      const ws = new WebSocket(wsUrl);
      let ref = 1;
      let joined = false;
      let hb = null;
      ws.onopen = () => {
        rtOpen.add(1);
        ws.send(JSON.stringify({
          topic, event: 'phx_join', ref: '1', join_ref: '1',
          payload: { config: { broadcast: { ack: false, self: false }, presence: { key: '' }, private: true }, access_token: u.token },
        }));
        hb = setInterval(() => {
          ref += 1;
          ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(ref) }));
        }, 25000);
        setTimeout(() => { if (hb) clearInterval(hb); ws.close(); }, holdMs - n * 400);
      };
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.event === 'phx_reply' && m.ref === '1') {
          joined = m.payload && m.payload.status === 'ok';
          rtJoinOk.add(joined);
          if (!joined) { console.error(`join failed: ${e.data}`); ws.close(); }
        } else if (m.event === 'broadcast' && m.payload && m.payload.event === 'message_insert') {
          const content = (m.payload.payload && m.payload.payload.content) || '';
          const hit = /lt-ts=(\d+)/.exec(content);
          if (hit) { rtLatency.add(Date.now() - Number(hit[1])); rtReceived.add(1); }
        }
      };
      ws.onerror = (e) => {
        if (!joined) rtJoinOk.add(false);
        console.error(`ws error: ${e.error}`);
        if (hb) clearInterval(hb);
      };
    }, n * 400);
  }
}

export function sender(data) {
  const u = pick(data.users);
  const p = params(u, 'send_message', 'write');
  p.headers.Prefer = 'return=minimal';
  const r = http.post(
    `${URL}/rest/v1/chat_messages`,
    JSON.stringify({ group_id: GROUP, sender_id: u.id, content: `בדיקת עומס lt-ts=${Date.now()}`, message_type: 'text' }),
    p,
  );
  if (check(r, { 'send 201': (x) => x.status === 201 })) sent.add(1);
  else console.error(`send failed: ${r.status} ${r.body}`);
}
