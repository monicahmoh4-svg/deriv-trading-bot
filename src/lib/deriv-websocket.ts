import { v4 as uuidv4 } from 'uuid';

export interface TickData {
  symbol: string;
  quote: number;
  epoch: number;
  pip_size: number;
}

export interface CandleData {
  symbol: string;
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ContractProposal {
  contract_id: number;
  contract_type: string;
  symbol: string;
  description: string;
  payout: number;
  entry_tick: number;
  entry_tick_time: number;
  barrier?: number;
  duration: number;
}

export type WebSocketEventType =
  | 'tick'
  | 'candle'
  | 'proposal'
  | 'proposal_open_contract'
  | 'balance'
  | 'portfolio'
  | 'buy'
  | 'sell'
  | 'error'
  | 'connected'
  | 'authenticated'
  | 'disconnected';

export interface WebSocketEvent {
  type: WebSocketEventType;
  data: unknown;
}

type EventHandler = (data: unknown) => void;

export class DerivWebSocket {
  private ws: WebSocket | null = null;
  private appId: string;
  private token: string | null = null;
  private subscribers: Map<string, Set<EventHandler>> = new Map();
  private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (reason: unknown) => void }> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isAuthenticated = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private url: string;

  constructor(appId: string) {
    this.appId = appId;
    this.url = `wss://ws.derivws.com/websockets/v3?app_id=${appId}`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.emit('connected', {});
        this.startPing();
        resolve();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch {
          // Silently ignore parse errors
        }
      };

      this.ws.onerror = (error) => {
        this.emit('error', { message: 'WebSocket error', error });
        reject(error);
      };

      this.ws.onclose = () => {
        this.isAuthenticated = false;
        this.stopPing();
        this.emit('disconnected', {});
        this.handleReconnect();
      };
    });
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ping: 1 }));
      }
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleMessage(data: Record<string, unknown>): void {
    if (data.error) {
      const reqId = data.req_id as string;
      if (reqId && this.pendingRequests.has(reqId)) {
        const pending = this.pendingRequests.get(reqId)!;
        this.pendingRequests.delete(reqId);
        const errData = data.error as { code?: string; message?: string };
        pending.reject(new Error(errData.message || JSON.stringify(data.error)));
      }
      this.emit('error', data.error);
      return;
    }

    const reqId = data.req_id as string;
    if (reqId && this.pendingRequests.has(reqId)) {
      const pending = this.pendingRequests.get(reqId)!;
      this.pendingRequests.delete(reqId);
      pending.resolve(data);
    }

    if (data.authorize) {
      this.isAuthenticated = true;
      this.emit('authorized', data.authorize);
    }

    if (data.tick) {
      this.emit('tick', data.tick as TickData);
    }

    if (data.ohlc) {
      this.emit('candle', data.ohlc as CandleData);
    }

    if (data.proposal) {
      this.emit('proposal', data.proposal as ContractProposal);
    }

    if (data.proposal_open_contract) {
      this.emit('proposal_open_contract', data.proposal_open_contract);
    }

    if (data.balance) {
      this.emit('balance', data.balance);
    }

    if (data.portfolio) {
      this.emit('portfolio', data.portfolio);
    }

    if (data.buy) {
      this.emit('buy', data.buy);
    }

    if (data.sell) {
      this.emit('sell', data.sell);
    }
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      setTimeout(() => {
        this.connect().then(() => {
          if (this.token) {
            this.authenticate(this.token);
          }
        }).catch(() => {});
      }, delay);
    }
  }

  authenticate(token: string): Promise<unknown> {
    this.token = token;
    return this.sendRequest({
      authorize: token,
    }).then((response) => {
      this.isAuthenticated = true;
      this.emit('authenticated', response);
      return response;
    });
  }

  private sendRequest(request: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const reqId = uuidv4();
      this.pendingRequests.set(reqId, { resolve, reject });

      this.ws.send(JSON.stringify({ ...request, req_id: reqId }));

      setTimeout(() => {
        if (this.pendingRequests.has(reqId)) {
          this.pendingRequests.delete(reqId);
          reject(new Error('Request timed out'));
        }
      }, 30000);
    });
  }

  subscribeTicks(symbol: string): void {
    this.sendRequest({
      ticks: symbol,
      subscribe: 1,
    }).catch(() => {});
  }

  unsubscribeTicks(symbol: string): void {
    this.sendRequest({
      ticks: symbol,
      forget: 1,
    }).catch(() => {});
  }

  subscribeProposalOpenContract(contractId: number): void {
    this.sendRequest({
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1,
    }).catch(() => {});
  }

  subscribeCandles(symbol: string, count: number = 100): void {
    this.sendRequest({
      ticks_history: symbol,
      adjust_start_time: 1,
      count,
      end: 'latest',
      style: 'candles',
      subscribe: 1,
    }).catch(() => {});
  }

  async getTicksHistory(symbol: string, count: number = 1000): Promise<TickData[]> {
    const response = (await this.sendRequest({
      ticks_history: symbol,
      adjust_start_time: 1,
      count,
      end: 'latest',
      style: 'ticks',
    })) as { history?: { prices: number[]; times: number[] } };

    if (response.history) {
      return response.history.prices.map((price, i) => ({
        symbol,
        quote: price,
        epoch: response.history!.times[i],
        pip_size: 0.01,
      }));
    }
    return [];
  }

  async getCandlesHistory(symbol: string, count: number = 100): Promise<CandleData[]> {
    const response = (await this.sendRequest({
      ticks_history: symbol,
      adjust_start_time: 1,
      count,
      end: 'latest',
      style: 'candles',
    })) as { history?: { prices: number[]; times: number[]; open: number[]; high: number[]; low: number[]; close: number[] } };

    if (response.history) {
      const h = response.history;
      return h.prices.map((_, i) => ({
        symbol,
        epoch: h.times[i],
        open: h.open[i],
        high: h.high[i],
        low: h.low[i],
        close: h.close[i],
        volume: 0,
      }));
    }
    return [];
  }

  async getBalance(): Promise<{ balance: number; currency: string }> {
    const response = (await this.sendRequest({
      balance: 1,
      subscribe: 1,
    })) as { balance?: { balance: number; currency: string } };

    return response.balance || { balance: 0, currency: 'USD' };
  }

  async getPortfolio(): Promise<unknown> {
    const response = (await this.sendRequest({
      portfolio: 1,
    })) as { portfolio?: unknown };

    return response.portfolio || {};
  }

  async getContractProposal(params: {
    contract_type: string;
    symbol: string;
    duration: number;
    duration_unit: string;
    amount: number;
    basis: string;
    currency: string;
    barrier?: string;
  }): Promise<ContractProposal> {
    const response = (await this.sendRequest({
      proposal: 1,
      ...params,
    })) as { proposal?: ContractProposal };

    return response.proposal!;
  }

  async buyContract(contractId: number, amount: number): Promise<unknown> {
    const response = (await this.sendRequest({
      buy: contractId,
      price: amount,
    })) as { buy?: unknown };

    return response.buy || {};
  }

  async sellContract(contractId: number): Promise<unknown> {
    const response = (await this.sendRequest({
      sell: contractId,
      price: 0,
    })) as { sell?: unknown };

    return response.sell || {};
  }

  on(event: string, handler: EventHandler): void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.subscribers.get(event)?.delete(handler);
  }

  private emit(event: string, data: unknown): void {
    this.subscribers.get(event)?.forEach((handler) => handler(data));
  }

  disconnect(): void {
    this.stopPing();
    this.token = null;
    this.isAuthenticated = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get authenticated(): boolean {
    return this.isAuthenticated;
  }
}

export const DERIV_APP_ID = process.env.NEXT_PUBLIC_DERIV_APP_ID || '1014';
export const DERIV_REDIRECT_URI = process.env.NEXT_PUBLIC_DERIV_REDIRECT_URI || 'https://deriv-trading-bot-two.vercel.app';

let instance: DerivWebSocket | null = null;

export function getDerivWebSocket(): DerivWebSocket {
  if (!instance) {
    instance = new DerivWebSocket(DERIV_APP_ID);
  }
  return instance;
}
