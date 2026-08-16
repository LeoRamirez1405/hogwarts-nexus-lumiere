import { attemptRefresh } from "@/lib/api/core/client";

type WSListener<T = unknown> = (data: T) => void;

interface WSMessage {
  t: string;
  c?: string;
  m?: unknown;
  u?: string;
  ts?: number;
  s?: string;
  r?: unknown[];
  b?: string;
  n?: unknown;
  e?: unknown;
  e2e?: boolean;
  lm?: unknown;
}

interface WSTokenResponse {
  token: string;
  expires_in: number;
}

const getWsUrl = () => {
  if (typeof window === "undefined") return "";
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.host}`;

  // We connect straight to the backend over WSS — NOT through the Next /api
  // proxy, which does not forward WebSocket upgrades to browsers (the handshake
  // fails with close 1006 even though plain HTTP proxies fine). The route is
  // /messages/ws (no /api prefix — that only exists as the REST proxy) and the
  // token travels in the subprotocol, never in the URL.
  if (backendUrl.startsWith("https")) {
    // Production: the backend is already served over TLS.
    return `wss://${new URL(backendUrl).host}/messages/ws`;
  }

  // Dev: the backend is plain HTTP, but the page is HTTPS so we need wss://.
  // A local WSS->WS bridge (backend/ws_tls_bridge.py, started by run.py)
  // terminates TLS on :8443 with the mkcert cert and forwards to the backend.
  // Use the page's hostname so it also works over the LAN IP on mobile.
  const bridgePort = process.env.NEXT_PUBLIC_WS_BRIDGE_PORT || "8443";
  return `wss://${window.location.hostname}:${bridgePort}/messages/ws`;
};

const getApiBase = () => {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/api`;
};

class WSClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnect = 10;
  private listeners = new Map<string, Set<WSListener>>();
  private token: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private isMobile: boolean = false;
  private heartbeatMs: number = 60000;
  private url: string = "";
  private initialized = false;

  private async fetchWSToken(): Promise<string> {
    let res = await fetch(`${getApiBase()}/auth/ws-token`, {
      credentials: "include",
    });

    // The access cookie may have expired (7 days). Every other API call goes
    // through `request()` which transparently refreshes it; retry here once
    // after refreshing so the socket isn't stuck in a 401 reconnect loop.
    if (res.status === 401 && (await attemptRefresh())) {
      res = await fetch(`${getApiBase()}/auth/ws-token`, {
        credentials: "include",
      });
    }

    if (!res.ok) {
      const err = new Error(`Failed to fetch WS token (${res.status})`);
      (err as Error & { status: number }).status = res.status;
      throw err;
    }
    const data: WSTokenResponse = await res.json();
    return data.token;
  }

  private ensureInitialized() {
    if (this.initialized || typeof window === "undefined") return;
    this.isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    this.heartbeatMs = this.isMobile ? 25000 : 60000;
    this.url = getWsUrl();
    this.setupVisibilityHandling();
    this.initialized = true;
  }

  private setupVisibilityHandling() {
    if (typeof document === "undefined") return;

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.pauseHeartbeat();
      } else {
        this.resumeHeartbeat();
        this.requestCatchUp();
      }
    });
  }

  connect(token?: string) {
    this.ensureInitialized();
    this.reconnectAttempts = 0;

    // Already connected or connecting — nothing to do.
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    const doConnect = async (wsToken: string) => {
      this.token = wsToken;
      // The access token travels as the WebSocket subprotocol (Sec-WebSocket-Protocol)
      // instead of a query parameter so it never ends up in URLs/logs/Referer.
      // JWTs are valid subprotocol tokens (base64url + dots).
      this.ws = new WebSocket(this.url, [wsToken]);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        console.info(`[ws] conectado → ${this.url}`);
        this.emit("open", {});
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (err) {
          console.error("WS parse error:", err);
        }
      };

      this.ws.onclose = (event) => {
        this.stopHeartbeat();
        if (this.reconnectAttempts >= this.maxReconnect) {
          console.warn(`[ws] cerrado (code=${event.code}) — máximo de reconexiones alcanzado (${this.maxReconnect})`);
        } else {
          const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
          console.warn(`[ws] cerrado (code=${event.code}, reason="${event.reason || ""}") — reconexión en ~${delay}ms (intento ${this.reconnectAttempts + 1}/${this.maxReconnect})`);
        }
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        // Browsers fire an opaque Event (no .message) for any WebSocket
        // failure; the actionable signal arrives via `onclose`, which
        // already triggers reconnection. Avoid cluttering the console.
      };
    };

    if (token) {
      doConnect(token);
    } else {
      this.fetchWSToken().then(doConnect).catch((err) => {
        if ((err as { status?: number }).status !== 401) {
          console.warn("Failed to fetch WS token:", (err as Error).message);
        }
        this.emit("error", err);
        this.scheduleReconnect();
      });
    }
  }

  private handleMessage(msg: WSMessage) {
    switch (msg.t) {
      case "new_message":
        this.emit("new_message", msg);
        break;
      case "typing":
        this.emit("typing", msg);
        break;
      case "typing_stop":
        this.emit("typing_stop", msg);
        break;
      case "presence":
        this.emit("presence", msg);
        break;
      case "read_receipt":
        this.emit("read_receipt", msg);
        break;
      case "reaction_update":
        this.emit("reaction_update", msg);
        break;
      case "delete":
        this.emit("delete", msg);
        break;
      case "edit":
        this.emit("edit", msg);
        break;
      case "notification":
        this.emit("notification", msg);
        break;
      case "notification_refresh":
        this.emit("notification_refresh", msg);
        break;
      case "pong":
        this.emit("pong", msg);
        break;
      default:
        this.emit(msg.t, msg);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnect) {
      this.emit("max_reconnect_reached", {});
      return;
    }

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;

    setTimeout(async () => {
      try {
        const newToken = await this.fetchWSToken();
        this.connect(newToken);
      } catch (err) {
        if ((err as { status?: number }).status !== 401) {
          console.warn("Failed to fetch WS token for reconnect:", (err as Error).message);
        }
        this.scheduleReconnect();
      }
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ t: "ping" });
      }
    }, this.heartbeatMs);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private pauseHeartbeat() {
    this.stopHeartbeat();
  }

  private resumeHeartbeat() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.startHeartbeat();
    }
  }

  private requestCatchUp() {
    this.emit("catch_up_requested", {});
  }

  send(data: WSMessage): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    console.warn(`[ws] socket no abierto (readyState=${this.ws?.readyState ?? "null"}) — ${data.t} no se envió por WS`);
    return false;
  }

  // Client -> Server messages
  sendMessage(conversationId: string, messageData: unknown, e2e = false) {
    const sent = this.send({
      t: "send_message",
      c: conversationId,
      m: messageData,
      e2e,
      ts: Date.now(),
    });
    console.info(`[ws] send_message ${sent ? "enviado por WebSocket" : "DESCARTADO (socket cerrado)"}${e2e ? " (e2e)" : ""}`);
  }

  typingStart(conversationId: string) {
    this.send({ t: "typing_start", c: conversationId });
  }

  typingStop(conversationId: string) {
    this.send({ t: "typing_stop", c: conversationId });
  }

  markRead(conversationId: string, messageId: string) {
    this.send({ t: "mark_read", c: conversationId, m: messageId });
  }

  editMessage(messageId: string, conversationId: string, body: string) {
    this.send({ t: "edit_message", c: conversationId, m: messageId, b: body });
  }

  deleteMessage(messageId: string, conversationId: string) {
    this.send({ t: "delete_message", c: conversationId, m: messageId });
  }

  // Event listeners
  on<T = unknown>(type: string, fn: WSListener<T>) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(fn as WSListener);
    return () => this.off(type, fn);
  }

  off<T = unknown>(type: string, fn: WSListener<T>) {
    this.listeners.get(type)?.delete(fn as WSListener);
  }

  private emit(type: string, data: unknown) {
    this.listeners.get(type)?.forEach((fn) => {
      try {
        fn(data);
      } catch (err) {
        console.error(`WS listener error (${type}):`, err);
      }
    });
  }

  disconnect() {
    this.stopHeartbeat();
    this.maxReconnect = 0;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get readyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsClient = new WSClient();
export type { WSMessage, WSListener };