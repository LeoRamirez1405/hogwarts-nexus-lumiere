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
}

class WSClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnect = 10;
  private listeners = new Map<string, Set<WSListener>>();
  private token: string | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private isMobile: boolean;
  private heartbeatMs: number;
  private url: string;

  constructor() {
    this.isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    this.heartbeatMs = this.isMobile ? 25000 : 60000;
    this.url = this.getWsUrl();
    this.setupVisibilityHandling();
  }

  private getWsUrl(): string {
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

  connect(token: string) {
    this.token = token;
    this.reconnectAttempts = 0;

    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = `${this.url}?token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(wsUrl);

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

    this.ws.onerror = (err) => {
      console.error("WS error:", err);
      this.emit("error", err);
    };
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

    setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
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