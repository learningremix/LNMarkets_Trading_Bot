/**
 * LN Markets Service - Wrapper for SDK v3
 * Bitcoin-focused trading on Lightning Network
 */

import { createHttpClient } from '@ln-markets/sdk/v3';

export interface LNMarketsConfig {
  key: string;
  secret: string;
  passphrase: string;
  network?: 'mainnet' | 'testnet';
}

export interface TradeParams {
  type: 'market' | 'limit';
  side: 'buy' | 'sell';
  quantity?: number;
  margin?: number;
  leverage: number;
  price?: number;
  takeprofit?: number;
  stoploss?: number;
}

export interface Position {
  id: string;
  side: 'buy' | 'sell';
  quantity: number;
  margin: number;
  leverage: number;
  entryPrice: number;
  liquidationPrice: number;
  pl: number;
  plPercent: number;
  createdAt: Date;
}

export interface MarketData {
  index: number;
  lastPrice: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  change24h: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type LNClient = ReturnType<typeof createHttpClient>;

export class LNMarketsService {
  private client: LNClient;
  private isAuthenticated: boolean;

  constructor(config?: LNMarketsConfig) {
    if (config) {
      this.client = createHttpClient({
        key: config.key,
        secret: config.secret,
        passphrase: config.passphrase,
        network: config.network === 'testnet' ? 'testnet4' : 'mainnet',
      });
      this.isAuthenticated = true;
    } else {
      this.client = createHttpClient();
      this.isAuthenticated = false;
    }
  }

  // ============ PUBLIC ENDPOINTS ============

  async ping(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async getServerTime(): Promise<number> {
    const result = await this.client.time();
    return (result as any).time || Date.now();
  }

  async getTicker(): Promise<MarketData> {
    const ticker: any = await this.client.futures.getTicket();
    return {
      index: ticker.index || 0,
      lastPrice: ticker.lastPrice || ticker.last_price || 0,
      bid: ticker.bid || 0,
      ask: ticker.ask || 0,
      high24h: ticker.high24h || ticker.high || 0,
      low24h: ticker.low24h || ticker.low || 0,
      volume24h: ticker.volume24h || ticker.volume || 0,
      change24h: ticker.change24h || 0,
    };
  }

  async getCandles(params: {
    from: string;
    to: string;
    interval: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';
  }): Promise<Candle[]> {
    const candles: any = await (this.client.futures.getCandles as any)({
      from: params.from,
      to: params.to,
      resolution: params.interval,
    });

    if (!Array.isArray(candles)) {
      return [];
    }

    return candles.map((c: any) => ({
      time: c.time || c.t || 0,
      open: c.open || c.o || 0,
      high: c.high || c.h || 0,
      low: c.low || c.l || 0,
      close: c.close || c.c || 0,
      volume: c.volume || c.v || 0,
    }));
  }

  async getOraclePrice(): Promise<{ price: number; index: number }> {
    const [lastPrice, indexData]: any = await Promise.all([
      this.client.oracle.getLastPrice(),
      this.client.oracle.getIndex(),
    ]);
    return {
      price: lastPrice?.lastPrice || lastPrice?.price || 0,
      index: indexData?.index || 0,
    };
  }

  async getLeaderboard() {
    return this.client.futures.getLeaderboard();
  }

  // ============ AUTHENTICATED ENDPOINTS ============

  private ensureAuthenticated() {
    if (!this.isAuthenticated) {
      throw new Error('LNMarkets client is not authenticated. Provide API credentials.');
    }
  }

  async getAccount() {
    this.ensureAuthenticated();
    const account: any = await this.client.account.get();
    return {
      balance: account.balance || 0,
      syntheticUsdBalance: account.syntheticUsdBalance || account.synthetic_usd_balance || 0,
      username: account.username || '',
    };
  }

  async getBalance(): Promise<number> {
    const account = await this.getAccount();
    return account.balance;
  }

  // ============ ISOLATED MARGIN TRADING ============

  async openIsolatedPosition(params: TradeParams): Promise<Position> {
    this.ensureAuthenticated();

    const tradeParams: any = {
      type: params.type,
      side: params.side,
      leverage: params.leverage,
    };

    if (params.quantity) tradeParams.quantity = params.quantity;
    if (params.margin) tradeParams.margin = params.margin;
    if (params.price && params.type === 'limit') tradeParams.price = params.price;
    if (params.takeprofit) tradeParams.takeProfitPrice = params.takeprofit;
    if (params.stoploss) tradeParams.stopLossPrice = params.stoploss;

    const trade: any = await this.client.futures.isolated.newTrade(tradeParams);

    return this.mapToPosition(trade);
  }

  async getOpenIsolatedOrders(): Promise<Position[]> {
    this.ensureAuthenticated();
    const trades: any = await this.client.futures.isolated.getOpenTrades();
    return Array.isArray(trades) ? trades.map(this.mapToPosition) : [];
  }

  async getRunningIsolatedPositions(): Promise<Position[]> {
    this.ensureAuthenticated();
    const trades: any = await this.client.futures.isolated.getRunningTrades();
    return Array.isArray(trades) ? trades.map(this.mapToPosition) : [];
  }

  async getClosedIsolatedTrades(params?: { from?: string; to?: string }) {
    this.ensureAuthenticated();
    return this.client.futures.isolated.getClosedTrades(params as any);
  }

  async closeIsolatedPosition(id: string): Promise<void> {
    this.ensureAuthenticated();
    await this.client.futures.isolated.close({ id });
  }

  async cancelIsolatedOrder(id: string): Promise<void> {
    this.ensureAuthenticated();
    await this.client.futures.isolated.cancel({ id });
  }

  async cancelAllIsolatedOrders(): Promise<void> {
    this.ensureAuthenticated();
    await this.client.futures.isolated.cancelAll();
  }

  async updateIsolatedTakeProfit(id: string, takeprofit: number): Promise<void> {
    this.ensureAuthenticated();
    await this.client.futures.isolated.updateTakeprofit({ id, takeProfitPrice: takeprofit } as any);
  }

  async updateIsolatedStopLoss(id: string, stoploss: number): Promise<void> {
    this.ensureAuthenticated();
    await this.client.futures.isolated.updateStoploss({ id, stopLossPrice: stoploss } as any);
  }

  async addIsolatedMargin(id: string, amount: number): Promise<void> {
    this.ensureAuthenticated();
    await this.client.futures.isolated.addMargin({ id, amount });
  }

  async cashInIsolatedProfit(id: string, amount: number): Promise<void> {
    this.ensureAuthenticated();
    await this.client.futures.isolated.cashIn({ id, amount });
  }

  // ============ CROSS MARGIN TRADING ============

  async depositToCrossMargin(amount: number): Promise<void> {
    this.ensureAuthenticated();
    await this.client.futures.cross.deposit({ amount });
  }

  async withdrawFromCrossMargin(amount: number): Promise<void> {
    this.ensureAuthenticated();
    await this.client.futures.cross.withdraw({ amount });
  }

  async setCrossLeverage(leverage: number): Promise<void> {
    this.ensureAuthenticated();
    await this.client.futures.cross.setLeverage({ leverage });
  }

  async openCrossOrder(params: {
    type: 'market' | 'limit';
    side: 'buy' | 'sell';
    quantity: number;
    price?: number;
  }): Promise<any> {
    this.ensureAuthenticated();
    return this.client.futures.cross.newOrder(params as any);
  }

  async getCrossPosition() {
    this.ensureAuthenticated();
    return this.client.futures.cross.getPosition();
  }

  async getCrossOpenOrders() {
    this.ensureAuthenticated();
    return this.client.futures.cross.getOpenOrders();
  }

  async closeCrossPosition(): Promise<void> {
    this.ensureAuthenticated();
    await this.client.futures.cross.close();
  }

  async cancelCrossOrder(id: string): Promise<void> {
    this.ensureAuthenticated();
    await this.client.futures.cross.cancel({ id });
  }

  async cancelAllCrossOrders(): Promise<void> {
    this.ensureAuthenticated();
    await this.client.futures.cross.cancelAll();
  }

  // ============ SYNTHETIC USD ============

  async getSyntheticUsdPrice() {
    this.ensureAuthenticated();
    return this.client.syntheticUsd.getBestPrice();
  }

  async swapToSyntheticUsd(quantity: number) {
    this.ensureAuthenticated();
    return this.client.syntheticUsd.newSwap({ side: 'buy', quantity } as any);
  }

  async swapFromSyntheticUsd(quantity: number) {
    this.ensureAuthenticated();
    return this.client.syntheticUsd.newSwap({ side: 'sell', quantity } as any);
  }

  // ============ DEPOSITS & WITHDRAWALS ============

  async createLightningDeposit(amount: number) {
    this.ensureAuthenticated();
    return this.client.account.depositLightning({ amount });
  }

  async withdrawLightning(invoice: string) {
    this.ensureAuthenticated();
    return this.client.account.withdrawLightning({ invoice });
  }

  async getLightningDeposits() {
    this.ensureAuthenticated();
    return this.client.account.getLightningDeposits();
  }

  async getLightningWithdrawals() {
    this.ensureAuthenticated();
    return this.client.account.getLightningWithdrawals();
  }

  // ============ HELPERS ============

  private mapToPosition = (trade: any): Position => ({
    id: trade.id || '',
    side: trade.side || 'buy',
    quantity: trade.quantity || 0,
    margin: trade.margin || 0,
    leverage: trade.leverage || 1,
    entryPrice: trade.entryPrice || trade.entry_price || trade.price || 0,
    liquidationPrice: trade.liquidation || trade.liquidationPrice || 0,
    pl: trade.pl || 0,
    plPercent: trade.plPercent || trade.pl_percent || 0,
    createdAt: new Date(trade.createdAt || trade.created_at || Date.now()),
  });
}

// Singleton instance factory
let instance: LNMarketsService | null = null;

export function getLNMarketsService(config?: LNMarketsConfig): LNMarketsService {
  if (!instance || config) {
    instance = new LNMarketsService(config);
  }
  return instance;
}

export function createLNMarketsService(config?: LNMarketsConfig): LNMarketsService {
  return new LNMarketsService(config);
}
