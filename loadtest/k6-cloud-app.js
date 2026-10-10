// בדיקה מקיפה — 100 משתמשים «אמיתיים» בכל האפליקציה (Grafana Cloud, עד 100 VUs).
// הבקשות לקוחות מתעבורה אמיתית של משתמשים (edge logs של 24 השעות שלפני 2026-10-10),
// והתמהיל לפי השכיחות בפועל. קצב אנושי: «זמן קריאה» בין מסכים.
// • 85 VUs = משתמשים שפותחים את האפליקציה וגולשים (צ'אט, יומן מסחר, Dark Pool, אקדמיה, יומנים, חדשות...)
// • 10 VUs × 10 = 100 חיבורי צ'אט חי (כל «משתמש» מחובר)
// • 2 VUs = כותבים בקבוצה בקצב של קבוצה פעילה
// בטיחות: כתיבה רק לשורות של משתמשי הבדיקה / קבוצת LOADTEST. בלי כתיבה למטמונים משותפים
// (portfolio_price_cache / economic_events_cache), בלי claim_active_device, בלי העלאות ופושים.
import http from 'k6/http';
import { WebSocket } from 'k6/websockets';
import { setInterval, setTimeout, clearInterval } from 'k6/timers';
import { check, group, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const URL = __ENV.SUPABASE_URL;
const ANON = __ENV.ANON_KEY;
const PW = __ENV.LT_PASSWORD;
const GROUP = __ENV.GROUP_ID;
// תיק ציבורי עם נתונים אמיתיים (86 עסקאות, 418 סנאפשוטים) — קריאה בלבד, כמו צפייה בתיק
const PORTFOLIO = __ENV.PORTFOLIO_ID || '1e1597e1-c3de-4e9e-ba95-c7fa1b704b89';
const SMOKE = __ENV.SMOKE === '1';
const USERS = Number(__ENV.USERS || (SMOKE ? 3 : 85));
const RT_VUS = Number(__ENV.RT_VUS || (SMOKE ? 1 : 10));
const WS_PER_VU = Number(__ENV.WS_PER_VU || (SMOKE ? 3 : 10));
const LOGIN_USERS = Number(__ENV.LOGIN_USERS || (SMOKE ? 3 : 25));
const HOLD = SMOKE ? '1m' : '12m';

const rtLatency = new Trend('rt_message_latency_ms', true);
const rtJoinOk = new Rate('rt_join_ok');
const rtReceived = new Counter('rt_messages_received');
const sent = new Counter('chat_messages_sent');
const screenTime = new Trend('screen_load_ms', true);

export const options = {
  cloud: {
    name: `DarkPool full app ${SMOKE ? 'smoke' : '100 users'}`,
    distribution: { frankfurt: { loadZone: 'amazon:de:frankfurt', percent: 100 } },
  },
  setupTimeout: '2m',
  discardResponseBodies: true,
  scenarios: {
    users: {
      executor: 'ramping-vus', exec: 'session', startVUs: 0, gracefulRampDown: '30s',
      stages: SMOKE
        ? [{ duration: '15s', target: USERS }, { duration: HOLD, target: USERS }, { duration: '10s', target: 0 }]
        : [{ duration: '2m', target: USERS }, { duration: HOLD, target: USERS }, { duration: '1m', target: 0 }],
    },
    realtime: {
      executor: 'per-vu-iterations', exec: 'realtime', vus: RT_VUS, iterations: 1,
      maxDuration: SMOKE ? '2m' : '16m',
    },
    sender: {
      // ~1 הודעה כל 3 שניות — קבוצה פעילה מאוד
      executor: 'constant-arrival-rate', exec: 'sender', rate: 20, timeUnit: '1m',
      duration: SMOKE ? '50s' : '13m', startTime: SMOKE ? '15s' : '1m', preAllocatedVUs: 2, maxVUs: 2,
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.02', abortOnFail: true, delayAbortEval: '1m' }],
    'http_req_duration{kind:read}': ['p(95)<500'],
    'http_req_duration{kind:write}': ['p(95)<800'],
    screen_load_ms: ['p(95)<1500'],
    'screen_load_ms{screen:app_open}': ['p(95)<2000'],
    'screen_load_ms{screen:chat}': ['p(95)<1500'],
    'screen_load_ms{screen:journal}': ['p(95)<2000'],
    'screen_load_ms{screen:darkpool}': ['p(95)<2000'],
    'screen_load_ms{screen:academy}': ['p(95)<1500'],
    'screen_load_ms{screen:calendars}': ['p(95)<1500'],
    rt_join_ok: ['rate>0.98'],
    rt_message_latency_ms: ['p(95)<1500'],
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

const R = () => `${URL}/rest/v1/`;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const think = (min, max) => sleep(min + Math.random() * (max - min));
const iso = (d) => d.toISOString();
const day = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };

function p(u, name, kind = 'read', extra = {}) {
  return {
    headers: { apikey: ANON, Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip', ...extra },
    tags: { kind, name },
  };
}
const GET = (u, name, path) => ['GET', R() + path, null, p(u, name)];
const RPC = (u, name, body = {}, kind = 'read') => ['POST', `${R()}rpc/${name}`, JSON.stringify(body), p(u, `rpc_${name}`, kind)];

// מסך = בקשות שהאפליקציה שולחת במקביל כשנכנסים אליו
function screen(name, reqs) {
  const t0 = Date.now();
  const res = http.batch(reqs);
  screenTime.add(Date.now() - t0, { screen: name });
  res.forEach((r, i) => {
    const n = reqs[i][3].tags.name;
    check(r, { [`${n} ok`]: (x) => x.status >= 200 && x.status < 300 });
  });
}

// ---------- מסכים (לפי התעבורה האמיתית) ----------
function appOpen(u) {
  group('app_open', () => {
    screen('app_open', [
      ['GET', `${URL}/auth/v1/user`, null, p(u, 'auth_user')],
      RPC(u, 'get_my_profile'),
      RPC(u, 'get_my_active_device'),
      RPC(u, 'is_app_admin'),
      GET(u, 'subscriptions', `user_subscriptions?select=id,plan_id,status,starts_at,expires_at,auto_renew,subscription_plans(id,name,role,price,period)&user_id=eq.${u.id}&status=eq.active&order=created_at.desc&limit=1`),
      GET(u, 'my_groups_full', `chat_group_members?select=group_id,role,muted,is_muted,unread_count,mentioned_count,last_read_message_id,chat_groups(id,name,description,avatar_url,created_by,created_at,updated_at,members_count,messages_count,last_message_at,last_message_preview,settings)&user_id=eq.${u.id}&order=last_read_at.desc`),
      GET(u, 'groups_all', 'chat_groups?select=*&order=created_at.asc'),
      GET(u, 'stories', `user_stories?select=id,user_id,media_type,media_url,content,created_at,expires_at,background_color&expires_at=gt.${iso(new Date())}&order=created_at.desc`),
      GET(u, 'fear_greed', 'fear_and_greed_index?select=value,value_classification,timestamp,raw_data,updated_at&id=eq.1'),
      RPC(u, 'get_user_badges', { p_user_ids: [u.id] }),
      GET(u, 'notif_settings', `user_notification_settings?select=*&user_id=eq.${u.id}`),
    ]);
    // נוכחות (כמו האפליקציה) — השורה של משתמש הבדיקה בלבד
    http.patch(`${R()}users?id=eq.${u.id}`, JSON.stringify({ is_online: true, last_active: iso(new Date()) }),
      p(u, 'presence', 'write', { Prefer: 'return=minimal' }));
  });
}

function chat(u) {
  group('chat', () => {
    const msgSel = 'select=*,sender:users!chat_messages_sender_id_fkey(id,display_name,profile_picture,is_online)';
    const live = `group_id=eq.${GROUP}&or=(is_deleted.eq.false,deleted_for_everyone.eq.true)`;
    screen('chat', [
      GET(u, 'messages_page', `chat_messages?${msgSel}&${live}&order=created_at.desc&offset=0&limit=30`),
      GET(u, 'group_by_id', `chat_groups?select=*&id=eq.${GROUP}`),
      GET(u, 'my_role', `chat_group_members?select=role&group_id=eq.${GROUP}&user_id=eq.${u.id}`),
      RPC(u, 'set_chat_group_viewing', { p_group_id: GROUP, p_is_viewing: true }, 'write'),
      RPC(u, 'reset_unread_count', { p_group_id: GROUP, p_user_id: u.id, p_last_read_message_id: null }, 'write'),
    ]);
    think(5, 20);
    // השלמת הודעות חדשות (delta) — הבקשה השכיחה ביותר בתעבורה האמיתית
    const since = iso(new Date(Date.now() - (1 + Math.random() * 30) * 60000));
    screen('chat_delta', [
      GET(u, 'messages_delta', `chat_messages?${msgSel}&${live}&created_at=gt.${since}&order=created_at.asc&offset=0&limit=50`),
      GET(u, 'personal_deletions', `chat_message_personal_deletions?select=message_id&user_id=eq.${u.id}&limit=30`),
    ]);
    if (Math.random() < 0.3) {
      think(3, 10);
      screen('group_members', [
        GET(u, 'group_members', `chat_group_members?select=*,user:v_public_profiles(id,display_name,full_name,profile_picture,is_online,last_active)&group_id=eq.${GROUP}&order=role.desc,joined_at.asc&limit=200`),
      ]);
    }
    think(5, 25);
    http.post(`${R()}rpc/set_chat_group_viewing`, JSON.stringify({ p_group_id: GROUP, p_is_viewing: false }),
      p(u, 'rpc_set_chat_group_viewing', 'write'));
  });
}

function stories(u) {
  group('stories', () => {
    screen('stories', [
      GET(u, 'stories', `user_stories?select=id,user_id,media_type,media_url,content,created_at,expires_at,background_color&expires_at=gt.${iso(new Date())}&order=created_at.desc`),
      GET(u, 'story_views', `user_story_views?select=story_id&viewer_id=eq.${u.id}&limit=50`),
    ]);
  });
}

function journal(u) {
  group('journal', () => {
    screen('journal', [
      GET(u, 'portfolio', `portfolios?select=*&id=eq.${PORTFOLIO}`),
      GET(u, 'trades_open', `trades?select=*&portfolio_id=eq.${PORTFOLIO}&order=entry_date.desc&status=eq.OPEN`),
      GET(u, 'trades_closed', `trades?select=*&portfolio_id=eq.${PORTFOLIO}&order=entry_date.desc&status=eq.CLOSED`),
      GET(u, 'cash_flow', `v_portfolio_cash_flow?select=*&portfolio_id=eq.${PORTFOLIO}`),
      GET(u, 'holdings', `v_portfolio_holdings_raw?select=*&portfolio_id=eq.${PORTFOLIO}`),
      GET(u, 'broker_summary', `v_broker_portfolio_summary?select=*&portfolio_id=eq.${PORTFOLIO}`),
      ...['TSLA', 'NVDA', 'AAPL', 'SPCX', 'GRX'].map((s) =>
        GET(u, 'price_cache', `portfolio_price_cache?select=*&symbol=eq.${s}&order=as_of.desc&limit=1`)),
    ]);
    think(5, 15);
    // גרף ביצועים / סטטיסטיקות
    screen('journal_stats', [
      GET(u, 'snapshots', `daily_portfolio_snapshots?select=snapshot_date,portfolio_value,deposits_today,withdrawals_today&portfolio_id=eq.${PORTFOLIO}&snapshot_date=gte.2021-04-19&order=snapshot_date.asc`),
      GET(u, 'trades_lean', `trades?select=symbol,direction,status,entry_date,exit_date,entry_price,quantity,leverage&portfolio_id=eq.${PORTFOLIO}&order=entry_date.asc`),
      GET(u, 'transactions', `portfolio_transactions?select=*&portfolio_id=eq.${PORTFOLIO}&order=date.desc&limit=5000`),
    ]);
  });
}

function darkpool(u) {
  group('darkpool', () => {
    screen('darkpool', [
      GET(u, 'uw_congress_holdings', 'dark_pool_uw_snapshots?select=payload&cache_key=eq.quiver_congress_holdings'),
      GET(u, 'congress_people', 'dark_pool_congress_trades?select=politician_id,politician_name,politician_image_url,filed_at&order=filed_at.desc&limit=500'),
      GET(u, 'insider_people', 'dark_pool_insider_buys?select=insider_name,insider_logo_url,ticker,filed_at,company_name,insider_role&order=filed_at.desc&limit=500'),
      GET(u, 'featured_profiles', 'dark_pool_featured_profiles?select=name,subtitle,image_url,person_id,kind,ticker&is_active=eq.true&order=sort_order.asc'),
    ]);
    think(5, 15);
    screen('darkpool_feed', [
      GET(u, 'congress_feed', 'dark_pool_congress_trades?select=external_id,politician_id,politician_name,politician_image_url,ticker,company_name,transaction_type,shares,price,amount_label,filed_at,transaction_date,txn_label,source,excess_return_pct,price_change_pct,spy_change_pct&order=filed_at.desc&limit=80'),
      GET(u, 'insider_feed', 'dark_pool_insider_buys?select=*&order=filed_at.desc&limit=50'),
    ]);
  });
}

function academy(u) {
  group('academy', () => {
    const courses = 'course_id=in.(oracle-course,david-training-course,whales-course-1)';
    screen('academy', [
      GET(u, 'courses', 'courses?select=*&is_active=eq.true&order=created_at.desc&offset=0&limit=20'),
      GET(u, 'lessons', `lessons?select=id,course_id,title,duration_minutes,order_index&${courses}&is_active=eq.true&order=order_index.asc`),
      GET(u, 'course_progress', `user_course_progress?select=course_id,lesson_id,is_completed,current_time_seconds&user_id=eq.${u.id}&${courses}`),
    ]);
  });
}

function calendars(u) {
  group('calendars', () => {
    screen('calendars', [
      GET(u, 'economic_week', `economic_events_cache?select=*&country=eq.US&order=date.asc,time.asc.nullslast&date=gte.${day(-7)}&date=lte.${day(0)}`),
      GET(u, 'economic_month', `economic_events_cache?select=*&country=eq.US&order=date.asc,time.asc.nullslast&date=gte.${day(0)}&date=lte.${day(30)}`),
      GET(u, 'economic_events', `economic_events?select=*&date=gte.${day(0)}&date=lte.${day(92)}&order=date.asc&limit=600`),
    ]);
    think(5, 15);
    screen('earnings', [
      GET(u, 'earnings', `earnings_calendar?select=id,code,ticker,company_name,report_date,before_after_market,actual,estimate,percent,revenue_actual,revenue_estimate,importance&report_date=gte.${day(-1)}&report_date=lte.${day(7)}&order=report_date.asc&limit=500`),
    ]);
  });
}

function misc(u) {
  group('misc', () => {
    screen('misc', [
      GET(u, 'news_count', 'app_news_clean?select=count&limit=1'),
      GET(u, 'news', 'app_news_clean?select=*&order=created_at.desc&limit=30'),
      GET(u, 'liked_articles', `liked_articles?select=article_id&user_id=eq.${u.id}`),
      GET(u, 'watchlists', `stock_watchlists?select=*&user_id=eq.${u.id}&order=sort_order.asc,created_at.asc`),
    ]);
  });
}

// משקל לפי שכיחות בתעבורה האמיתית
const JOURNEYS = [
  [chat, 34], [journal, 20], [darkpool, 15], [stories, 8], [calendars, 10], [academy, 7], [misc, 6],
];
const TOTAL_W = JOURNEYS.reduce((s, [, w]) => s + w, 0);
function pickJourney() {
  let r = Math.random() * TOTAL_W;
  for (const [fn, w] of JOURNEYS) { if ((r -= w) <= 0) return fn; }
  return chat;
}

// סשן: פתיחת אפליקציה → 3–8 מסכים עם זמן קריאה → יציאה, הפסקה, וחוזר חלילה
export function session(data) {
  const u = data.users[(__VU - 1) % data.users.length];
  appOpen(u);
  think(2, 6);
  const n = 3 + Math.floor(Math.random() * 6);
  for (let i = 0; i < n; i++) {
    pickJourney()(u);
    think(4, 15);
  }
  think(10, 40);
}

// כל VU מחזיק WS_PER_VU חיבורי צ'אט חי בו-זמנית (ערוץ פרטי כמו האפליקציה)
export function realtime(data) {
  const wsUrl = `${URL.replace('https://', 'wss://')}/realtime/v1/websocket?apikey=${ANON}&vsn=1.0.0`;
  const topic = `realtime:chat-group:${GROUP}`;
  const holdMs = SMOKE ? 75000 : 15 * 60000;
  for (let n = 0; n < WS_PER_VU; n++) {
    setTimeout(() => {
      const u = data.users[(n + __VU * WS_PER_VU) % data.users.length];
      const ws = new WebSocket(wsUrl);
      let ref = 1;
      let joined = false;
      let hb = null;
      ws.onopen = () => {
        ws.send(JSON.stringify({
          topic, event: 'phx_join', ref: '1', join_ref: '1',
          payload: { config: { broadcast: { ack: false, self: false }, presence: { key: '' }, private: true }, access_token: u.token },
        }));
        hb = setInterval(() => {
          ref += 1;
          ws.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(ref) }));
        }, 25000);
        setTimeout(() => { if (hb) clearInterval(hb); ws.close(); }, holdMs - n * 1000);
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
    }, n * 1000);
  }
}

export function sender(data) {
  const u = pick(data.users);
  const r = http.post(
    `${R()}chat_messages`,
    JSON.stringify({ group_id: GROUP, sender_id: u.id, content: `בדיקת עומס lt-ts=${Date.now()}`, message_type: 'text' }),
    p(u, 'send_message', 'write', { Prefer: 'return=minimal' }),
  );
  if (check(r, { 'send ok': (x) => x.status === 201 })) sent.add(1);
  else console.error(`send failed: ${r.status} ${r.body}`);
}
