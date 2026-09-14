import { v4 as uuidv4 } from 'uuid';
import { AdaptiveStrategy, MarketRegime, PatternType } from './ml-strategy';

export interface MarketData {
  symbol: string;
  ticks: { quote: number; epoch: number }[];
  candles?: { open: number; high: number; low: number; close: number; epoch: number }[];
}

export interface Signal {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  confidence: number;
  strategy: string;
  entry_price: number;
  timestamp: number;
  indicators: {
    sma: number;
    rsi: number;
    bollingerUpper: number;
    bollingerLower: number;
    bollingerMiddle: number;
  };
  regime?: MarketRegime;
  patterns?: PatternType[];
}

export interface TradingRules {
  stake: number;
  maxStake: number;
  targetProfit: number;
  stopLoss: number;
  maxTrades: number;
  strategy: 'conservative' | 'moderate' | 'aggressive';
  market: 'all' | 'synthetic' | 'forex' | 'commodities' | 'digits';
  autoTrade: boolean;
}

export interface Trade {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  contractType: string;
  stake: number;
  entryPrice: number;
  exitPrice?: number;
  profitLoss?: number;
  status: 'open' | 'closed' | 'expired';
  openTime: number;
  closeTime?: number;
  contractId?: number;
}

export interface TradeResult {
  success: boolean;
  trade?: Trade;
  error?: string;
}

export class TradingEngine {
  private markets: Map<string, MarketData> = new Map();
  private signalThreshold = 55;
  public mlStrategy: AdaptiveStrategy;

  constructor() {
    this.mlStrategy = new AdaptiveStrategy();
  }

  calculateSMA(prices: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        sma.push(NaN);
      } else {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) {
          sum += prices[j];
        }
        sma.push(sum / period);
      }
    }
    return sma;
  }

  calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    ema[0] = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema[i] = (prices[i] - ema[i - 1]) * multiplier + ema[i - 1];
    }
    return ema;
  }

  calculateRSI(prices: number[], period: number = 14): number[] {
    const rsi: number[] = [];
    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    for (let i = 0; i < prices.length; i++) {
      if (i < period) {
        rsi.push(NaN);
        continue;
      }
      let gains = 0;
      let losses = 0;
      for (let j = i - period; j < i; j++) {
        const change = changes[j];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
      }
      if (losses === 0) {
        rsi.push(100);
      } else {
        const rs = gains / losses;
        rsi.push(100 - 100 / (1 + rs));
      }
    }
    return rsi;
  }

  calculateBollingerBands(prices: number[], period: number = 20, stdDevMultiplier: number = 2): {
    upper: number[];
    middle: number[];
    lower: number[];
  } {
    const middle = this.calculateSMA(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        upper.push(NaN);
        lower.push(NaN);
        continue;
      }
      let sumSqDiff = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumSqDiff += Math.pow(prices[j] - middle[i], 2);
      }
      const stdDev = Math.sqrt(sumSqDiff / period);
      upper.push(middle[i] + stdDevMultiplier * stdDev);
      lower.push(middle[i] - stdDevMultiplier * stdDev);
    }
    return { upper, middle, lower };
  }

  calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): {
    macd: number[];
    signal: number[];
    histogram: number[];
  } {
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    const macd: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      macd.push(fastEMA[i] - slowEMA[i]);
    }
    const signal = this.calculateEMA(macd, signalPeriod);
    const histogram: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      histogram.push(macd[i] - signal[i]);
    }
    return { macd, signal, histogram };
  }

  analyzeMarket(data: MarketData): Signal | null {
    const prices = data.ticks.map((t) => t.quote);
    if (prices.length < 30) return null;

    const sma5 = this.calculateSMA(prices, 5);
    const sma20 = this.calculateSMA(prices, 20);
    const rsi = this.calculateRSI(prices);
    const bollinger = this.calculateBollingerBands(prices);
    const macd = this.calculateMACD(prices);

    const lastIndex = prices.length - 1;
    const prevIndex = lastIndex - 1;

    const currentSMA5 = sma5[lastIndex];
    const currentSMA20 = sma20[lastIndex];
    const prevSMA5 = sma5[prevIndex];
    const prevSMA20 = sma20[prevIndex];
    const currentRSI = rsi[lastIndex];
    const currentPrice = prices[lastIndex];

    if (isNaN(currentSMA5) || isNaN(currentSMA20) || isNaN(currentRSI)) {
      return null;
    }

    let buyScore = 0;
    let sellScore = 0;

    if (prevSMA5 <= prevSMA20 && currentSMA5 > currentSMA20) {
      buyScore += 30;
    } else if (prevSMA5 >= prevSMA20 && currentSMA5 < currentSMA20) {
      sellScore += 30;
    }

    if (currentSMA5 > currentSMA20) {
      buyScore += 15;
    } else {
      sellScore += 15;
    }

    if (currentRSI < 30) {
      buyScore += 25;
    } else if (currentRSI > 70) {
      sellScore += 25;
    } else if (currentRSI < 40) {
      buyScore += 10;
    } else if (currentRSI > 60) {
      sellScore += 10;
    }

    const currentBBUpper = bollinger.upper[lastIndex];
    const currentBBLower = bollinger.lower[lastIndex];
    if (!isNaN(currentBBUpper) && !isNaN(currentBBLower)) {
      if (currentPrice <= currentBBLower) {
        buyScore += 20;
      } else if (currentPrice >= currentBBUpper) {
        sellScore += 20;
      }
    }

    const currentMACD = macd.macd[lastIndex];
    const currentSignal = macd.signal[lastIndex];
    const prevMACD = macd.macd[prevIndex];
    const prevSignal = macd.signal[prevIndex];

    if (!isNaN(currentMACD) && !isNaN(currentSignal)) {
      if (prevMACD <= prevSignal && currentMACD > currentSignal) {
        buyScore += 20;
      } else if (prevMACD >= prevSignal && currentMACD < currentSignal) {
        sellScore += 20;
      }
    }

    const direction = buyScore > sellScore ? 'BUY' : 'SELL';
    const confidence = Math.min(100, Math.max(buyScore, sellScore));

    if (confidence < this.signalThreshold) {
      return null;
    }

    this.mlStrategy.updateRegimeHistory(prices);

    return {
      id: uuidv4(),
      symbol: data.symbol,
      direction,
      confidence,
      strategy: 'multi-indicator',
      entry_price: currentPrice,
      timestamp: Date.now(),
      indicators: {
        sma: currentSMA5,
        rsi: currentRSI,
        bollingerUpper: bollinger.upper[lastIndex] || 0,
        bollingerLower: bollinger.lower[lastIndex] || 0,
        bollingerMiddle: bollinger.middle[lastIndex] || 0,
      },
    };
  }

  analyzeDigitPattern(data: MarketData): Signal | null {
    const prices = data.ticks.map((t) => t.quote);
    if (prices.length < 20) return null;

    const lastDigits = prices.slice(-20).map((p) => {
      const str = p.toFixed(2);
      return parseInt(str[str.length - 1], 10);
    });

    const oddCount = lastDigits.filter((d) => d % 2 === 1).length;
    const evenCount = 20 - oddCount;

    const digitFreq = new Array(10).fill(0);
    lastDigits.forEach((d) => digitFreq[d]++);

    const leastFrequent = digitFreq.indexOf(Math.min(...digitFreq));
    const mostFrequent = digitFreq.indexOf(Math.max(...digitFreq));

    let direction: 'BUY' | 'SELL' = 'BUY';
    let confidence = 50;

    if (oddCount > 13) {
      direction = 'SELL';
      confidence = 50 + (oddCount - 10) * 5;
    } else if (evenCount > 13) {
      direction = 'BUY';
      confidence = 50 + (evenCount - 10) * 5;
    }

    if (lastDigits[lastDigits.length - 1] === mostFrequent) {
      confidence += 5;
    }
    if (lastDigits[lastDigits.length - 1] === leastFrequent) {
      confidence += 10;
    }

    confidence = Math.min(100, confidence);

    if (confidence < this.signalThreshold) {
      return null;
    }

    this.mlStrategy.updateRegimeHistory(prices);

    return {
      id: uuidv4(),
      symbol: data.symbol,
      direction,
      confidence,
      strategy: 'digit-analysis',
      entry_price: prices[prices.length - 1],
      timestamp: Date.now(),
      indicators: {
        sma: 0,
        rsi: oddCount / 20 * 100,
        bollingerUpper: mostFrequent,
        bollingerLower: leastFrequent,
        bollingerMiddle: 0,
      },
    };
  }

  generateSignal(marketData: MarketData): Signal | null {
    const isDigitMarket = marketData.symbol.includes('DIGIT') ||
      marketData.symbol.includes('BOOM') ||
      marketData.symbol.includes('CRASH');

    let baseSignal: Signal | null;

    if (isDigitMarket) {
      baseSignal = this.analyzeDigitPattern(marketData);
    } else {
      baseSignal = this.analyzeMarket(marketData);
    }

    if (!baseSignal) return null;

    const prices = marketData.ticks.map((t) => t.quote);
    const adaptiveSignal = this.mlStrategy.generateAdaptiveSignal(
      prices,
      baseSignal.confidence,
      baseSignal.direction,
      baseSignal.symbol,
      1
    );

    if (!adaptiveSignal) return null;

    return {
      ...baseSignal,
      confidence: adaptiveSignal.confidence,
      strategy: adaptiveSignal.strategy,
      regime: adaptiveSignal.regime,
      patterns: adaptiveSignal.patterns,
    };
  }

  executeTrade(signal: Signal, rules: TradingRules, balance: number): TradeResult {
    const stake = this.calculateStake(balance, rules, signal);
    if (stake <= 0) {
      return { success: false, error: 'Invalid stake amount' };
    }

    const contractType = this.getContractType(signal, rules);

    const trade: Trade = {
      id: uuidv4(),
      symbol: signal.symbol,
      direction: signal.direction,
      contractType,
      stake,
      entryPrice: signal.entry_price,
      status: 'open',
      openTime: Date.now(),
    };

    return { success: true, trade };
  }

  calculateStake(currentBalance: number, rules: TradingRules, signal?: Signal): number {
    let baseStake = rules.stake;

    if (rules.strategy === 'aggressive') {
      baseStake = Math.min(rules.maxStake, currentBalance * 0.05);
    } else if (rules.strategy === 'moderate') {
      baseStake = Math.min(rules.maxStake, currentBalance * 0.02);
    } else {
      baseStake = Math.min(rules.maxStake, currentBalance * 0.01);
    }

    baseStake = Math.max(baseStake, rules.stake);

    if (signal?.confidence) {
      const confMultiplier = 0.5 + (signal.confidence / 100) * 1.0;
      baseStake *= confMultiplier;
    }

    return Math.min(baseStake, rules.maxStake);
  }

  private getContractType(signal: Signal, rules: TradingRules): string {
    if (rules.market === 'digits') {
      return signal.direction === 'BUY' ? 'DIGITEVEN' : 'DIGITODD';
    }
    return signal.direction === 'BUY' ? 'CALL' : 'PUT';
  }

  setSignalThreshold(threshold: number): void {
    this.signalThreshold = Math.min(100, Math.max(0, threshold));
  }

  addTick(symbol: string, tick: { quote: number; epoch: number }): void {
    const market = this.markets.get(symbol);
    if (market) {
      market.ticks.push(tick);
      if (market.ticks.length > 1000) {
        market.ticks = market.ticks.slice(-1000);
      }
    } else {
      this.markets.set(symbol, { symbol, ticks: [tick] });
    }
  }

  getMarketData(symbol: string): MarketData | undefined {
    return this.markets.get(symbol);
  }

  getAllMarkets(): MarketData[] {
    return Array.from(this.markets.values());
  }

  getMLStats() {
    return {
      accuracy: this.mlStrategy.getOverallAccuracy(),
      strategies: this.mlStrategy.getStrategyStats(),
      recentRegime: this.mlStrategy.getRecentRegime(),
    };
  }
}

export const MARKETS = {
  synthetic: [
    { symbol: 'R_75', name: 'Volatility 75' },
    { symbol: 'R_50', name: 'Volatility 50' },
    { symbol: 'R_25', name: 'Volatility 25' },
    { symbol: 'R_10', name: 'Volatility 10' },
    { symbol: 'BOOM500', name: 'Boom 500' },
    { symbol: 'BOOM1000', name: 'Boom 1000' },
    { symbol: 'CRASH500', name: 'Crash 500' },
    { symbol: 'CRASH1000', name: 'Crash 1000' },
  ],
  forex: [
    { symbol: 'EURUSD', name: 'EUR/USD' },
    { symbol: 'GBPUSD', name: 'GBP/USD' },
    { symbol: 'USDJPY', name: 'USD/JPY' },
    { symbol: 'AUDUSD', name: 'AUD/USD' },
  ],
  commodities: [
    { symbol: 'frxXAUUSD', name: 'Gold' },
    { symbol: 'frxXAGUSD', name: 'Silver' },
    { symbol: 'frxXNGUSD', name: 'Natural Gas' },
  ],
};

export function getMarketsByCategory(category: string): { symbol: string; name: string }[] {
  switch (category) {
    case 'synthetic':
      return MARKETS.synthetic;
    case 'forex':
      return MARKETS.forex;
    case 'commodities':
      return MARKETS.commodities;
    case 'digits':
      return MARKETS.synthetic.filter((m) =>
        m.symbol.includes('BOOM') || m.symbol.includes('CRASH')
      );
    default:
      return [
        ...MARKETS.synthetic,
        ...MARKETS.forex,
        ...MARKETS.commodities,
      ];
  }
}
