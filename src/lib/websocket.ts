export interface WSMessage<T = any> {
  type: string;
  payload: T;
}

type MessageCallback = (payload: any) => void;

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string = '';
  private readonly messageQueue: string[] = [];
  private readonly listeners: Map<string, Set<MessageCallback>> = new Map();
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 5;

  public connect(url: string): void {
    if (this.socket) return;
    this.url = url;

    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log(`WebSocket connected to ${url}`);
      this.reconnectAttempts = 0;
      this.flushQueue();
    };

    this.socket.onmessage = (event) => {
      try {
        const data: WSMessage = JSON.parse(event.data);
        this.emit(data.type, data.payload);
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    this.socket.onclose = () => {
      console.log('WebSocket disconnected');
      this.socket = null;
      this.handleReconnect();
    };
  }

  public send(type: string, payload: any): void {
    const message = JSON.stringify({ type, payload });

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(message);
    } else {
      console.warn('Socket not ready. Queueing message...');
      this.messageQueue.push(message);
    }
  }

  public subscribe(type: string, callback: MessageCallback): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);

    return () => {
      const typeListeners = this.listeners.get(type);
      if (typeListeners) {
        typeListeners.delete(callback);
        if (typeListeners.size === 0) this.listeners.delete(type);
      }
    };
  }

  private emit(type: string, payload: any): void {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      typeListeners.forEach((callback) => callback(payload));
    }
  }

  private flushQueue(): void {
    while (this.messageQueue.length > 0 && this.socket?.readyState === WebSocket.OPEN) {
      const msg = this.messageQueue.shift();
      if (msg) this.socket.send(msg);
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * this.reconnectAttempts, 10000);
      console.log(`Attempting WebSocket reconnect ${this.reconnectAttempts} in ${delay}ms...`);
      setTimeout(() => this.connect(this.url), delay);
    }
  }
}
