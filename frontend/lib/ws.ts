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
}

interface WSTokenResponse {
  token: string;
  expires_in: number;
}

const API_BASE = (() => {
  if (typeof window === "undefined") return "";
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";
})();

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
    const res = await fetch(`${API_BASE}/api/auth/ws-token`, {
      credentials: "include",
    });
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
    this.url = this.getWsUrl();
    this.setupVisibilityHandling();
    this.initialized = true;
  }

  private getWsUrl(): string {
    if (typeof window === "undefined") return "";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = process.env.NEXT_PUBLIC_API_URL
      ? new URL(process.env.NEXT_PUBLIC_API_URL).host
      : window.location.host;
    return `${protocol}//${host}/api/messages/ws`;
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

      this.ws.onclose = () => {
        this.stopHeartbeat();
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

  send(data: WSMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  // Client -> Server messages
  sendMessage(conversationId: string, messageData: unknown) {
    this.send({
      t: "send_message",
      c: conversationId,
      m: messageData,
      ts: Date.now(),
    });
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