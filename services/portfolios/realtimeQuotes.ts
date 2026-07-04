/**
 * Singleton שמנהל חיבור WebSocket ל-Finnhub לזרם trades בזמן אמת.
 *
 *  פרוטוקול Finnhub WS:
 *    Endpoint:  wss://ws.finnhub.io?token=API_KEY
 *    Subscribe: { type: 'subscribe',   symbol: 'AAPL' }
 *    Unsub:     { type: 'unsubscribe', symbol: 'AAPL' }
 *    Trade msg: { type: 'trade', data: [{ s, p, t, v, c }] }
 *    Ping msg:  { type: 'ping' }    // יש לענות ב-pong שקט
 *
 *  התכונה תומכת בכמה consumers בו-זמנית באמצעות reference counting
 *  לכל סימבול: subscribe לראשון, unsubscribe כשהאחרון מתנתק.
 */

const FINNHUB_API_KEY = process.env.EXPO_PUBLIC_FINNHUB_API_KEY ?? '';
const FINNHUB_WS_URL = 'wss://ws.finnhub.io';

const RECONNECT_BASE_MS = 1500;
const RECONNECT_MAX_MS = 30_000;

type Listener = (symbol: string, price: number, ts: number) => void;

interface RealtimeMessage {
  type: 'trade' | 'ping' | string;
  data?: Array<{ s: string; p: number; t: number; v?: number }>;
}

class RealtimeQuotes {
  private ws: WebSocket | null = null;
  private isOpen = false;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<Listener>();
  /** סימבולים שאנחנו רוצים שיהיו פעילים. value = ספירת consumers. */
  private symbolRefCount = new Map<string, number>();
  /** סימבולים ש-subscribe להם נשלח בפועל ל-Finnhub. */
  private activeSubs = new Set<string>();
  /** מחיר אחרון שראינו לכל סימבול – שימוש להזרקה מיידית של נתון מטמון. */
  private lastPrice = new Map<string, { price: number; ts: number }>();

  // ---------- Public API ----------

  /** מנוי לעדכוני trades. מחזיר פונקציית unsubscribe. */
  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** מבקש מנוי על רשימת סימבולים. ניתן לקרוא שוב עם רשימה אחרת – נעשה diff. */
  subscribeMany(symbols: string[]): () => void {
    const unique = Array.from(new Set(symbols.filter(Boolean)));
    for (const s of unique) {
      const next = (this.symbolRefCount.get(s) ?? 0) + 1;
      this.symbolRefCount.set(s, next);
    }
    void this.ensureConnected();
    this.syncSubscriptions();

    let released = false;
    return () => {
      if (released) return;
      released = true;
      for (const s of unique) {
        const next = (this.symbolRefCount.get(s) ?? 1) - 1;
        if (next <= 0) this.symbolRefCount.delete(s);
        else this.symbolRefCount.set(s, next);
      }
      this.syncSubscriptions();
      if (this.symbolRefCount.size === 0) {
        this.disconnect();
      }
    };
  }

  /** המחיר האחרון שראינו ב-WS לסימבול (אם בכלל). */
  getLastPrice(symbol: string): { price: number; ts: number } | null {
    return this.lastPrice.get(symbol) ?? null;
  }

  /** סטטוס חיבור עכשיווי. */
  isConnected(): boolean {
    return this.isOpen;
  }

  // ---------- Internals ----------

  private async ensureConnected(): Promise<void> {
    if (this.isOpen || this.isConnecting) return;
    this.isConnecting = true;
    try {
      const url = `${FINNHUB_WS_URL}?token=${FINNHUB_API_KEY}`;
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        this.isOpen = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.activeSubs.clear();
        this.syncSubscriptions();
      };
      ws.onmessage = (ev: WebSocketMessageEvent) => {
        this.handleMessage(ev.data);
      };
      ws.onerror = () => {
        // לא שוברים - נתאושש מ-onclose
      };
      ws.onclose = () => {
        this.isOpen = false;
        this.isConnecting = false;
        this.activeSubs.clear();
        this.scheduleReconnect();
      };
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.isOpen = false;
    this.isConnecting = false;
    this.activeSubs.clear();
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    if (this.symbolRefCount.size === 0) return;
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_MS
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.ensureConnected();
    }, delay);
  }

  private syncSubscriptions() {
    if (!this.ws || !this.isOpen) return;
    const desired = new Set(this.symbolRefCount.keys());
    for (const s of desired) {
      if (!this.activeSubs.has(s)) {
        this.send({ type: 'subscribe', symbol: s });
        this.activeSubs.add(s);
      }
    }
    for (const s of Array.from(this.activeSubs)) {
      if (!desired.has(s)) {
        this.send({ type: 'unsubscribe', symbol: s });
        this.activeSubs.delete(s);
      }
    }
  }

  private send(payload: object) {
    if (!this.ws || !this.isOpen) return;
    try {
      this.ws.send(JSON.stringify(payload));
    } catch {
      // ignore – ננסה שוב כשנתחבר מחדש
    }
  }

  private handleMessage(raw: unknown) {
    if (typeof raw !== 'string') return;
    let msg: RealtimeMessage;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === 'ping') return;
    if (msg.type !== 'trade' || !Array.isArray(msg.data)) return;

    // עבור כל סימבול - שומרים את העסקה האחרונה ושולחים פעם אחת
    const latest = new Map<string, { price: number; ts: number }>();
    for (const trade of msg.data) {
      if (!trade || typeof trade.s !== 'string' || typeof trade.p !== 'number') continue;
      const ts = typeof trade.t === 'number' ? trade.t : Date.now();
      const prev = latest.get(trade.s);
      if (!prev || ts >= prev.ts) {
        latest.set(trade.s, { price: trade.p, ts });
      }
    }
    if (latest.size === 0) return;

    for (const [symbol, { price, ts }] of latest) {
      this.lastPrice.set(symbol, { price, ts });
      for (const fn of this.listeners) {
        try {
          fn(symbol, price, ts);
        } catch {
          // listener לא יפיל אחרים
        }
      }
    }
  }
}

export const realtimeQuotes = new RealtimeQuotes();
