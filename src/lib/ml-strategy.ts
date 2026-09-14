export type MarketRegime = 'trending_up' | 'trending_down' | 'ranging' | 'volatile' | 'breakout';
export type PatternType = 'double_top' | 'double_bottom' | 'head_shoulders' | 'inv_head_shoulders' | 'flag_bull' | 'flag_bear' | 'wedge' | 'none';

export interface RegimeResult {
  regime: MarketRegime;
  confidence: number;
  volatility: number;
  trendStrength: number;
}

export interface PatternResult {
  pattern: PatternType;
  confidence: number;
  direction: 'BUY' | 'SELL' | null;
}

export interface AdaptiveSignal {
  direction: 'BUY' | 'SELL';
  confidence: number;
  strategy: string;
  regime: MarketRegime;
  patterns: PatternType[];
  adjustedStake: number;
}

interface SignalRecord {
  direction: 'BUY' | 'SELL';
  outcome: 'win' | 'loss' | 'pending';
  confidence: number;
  timestamp: number;
  symbol: string;
}

interface StrategyPerformance {
  strategy: string;
  wins: number;
  losses: number;
  totalConfidence: number;
  lastUpdated: number;
}

const REGIME_WINDOW = 50;
const PATTERN_WINDOW = 30;
const PERFORMANCE_WINDOW = 100;

export class AdaptiveStrategy {
  private signalHistory: SignalRecord[] = [];
  private strategyPerformance: Map<string, StrategyPerformance> = new Map();
  private regimeHistory: RegimeResult[] = [];

  detectRegime(prices: number[]): RegimeResult {
    if (prices.length < REGIME_WINDOW) {
      return { regime: 'ranging', confidence: 30, volatility: 0, trendStrength: 0 };
    }

    const recent = prices.slice(-REGIME_WINDOW);
    const returns: number[] = [];
    for (let i = 1; i < recent.length; i++) {
      returns.push((recent[i] - recent[i - 1]) / recent[i - 1]);
    }

    const volatility = this.standardDeviation(returns) * Math.sqrt(252) * 100;
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const trendStrength = Math.abs(meanReturn) * 1000;

    const sma20 = this.sma(recent, 20);
    const sma50 = this.sma(recent, recent.length);
    const ema12 = this.ema(recent, 12);
    const ema26 = this.ema(recent, 26);
    const macdLine = ema12 - ema26;

    const adx = this.calculateADX(prices.slice(-REGIME_WINDOW), 14);

    if (adx > 25 && macdLine > 0 && recent[recent.length - 1] > sma20) {
      return { regime: 'trending_up', confidence: Math.min(90, 50 + adx), volatility, trendStrength };
    }
    if (adx > 25 && macdLine < 0 && recent[recent.length - 1] < sma20) {
      return { regime: 'trending_down', confidence: Math.min(90, 50 + adx), volatility, trendStrength };
    }
    if (volatility > 30) {
      return { regime: 'volatile', confidence: Math.min(85, 40 + volatility), volatility, trendStrength };
    }

    const recentHigh = Math.max(...recent.slice(-10));
    const recentLow = Math.min(...recent.slice(-10));
    const currentPrice = recent[recent.length - 1];
    const range = recentHigh - recentLow;
    const positionInRange = range > 0 ? (currentPrice - recentLow) / range : 0.5;

    if (positionInRange > 0.9 || positionInRange < 0.1) {
      return { regime: 'breakout', confidence: 60, volatility, trendStrength };
    }

    return { regime: 'ranging', confidence: Math.min(70, 100 - adx), volatility, trendStrength };
  }

  detectPattern(prices: number[]): PatternResult {
    if (prices.length < PATTERN_WINDOW) {
      return { pattern: 'none', confidence: 0, direction: null };
    }

    const recent = prices.slice(-PATTERN_WINDOW);
    const peaks = this.findPeaks(recent);
    const valleys = this.findValleys(recent);

    if (peaks.length >= 2) {
      const lastTwoPeaks = peaks.slice(-2);
      const priceDiff = Math.abs(lastTwoPeaks[0].value - lastTwoPeaks[1].value);
      const avgPrice = (lastTwoPeaks[0].value + lastTwoPeaks[1].value) / 2;
      const tolerance = avgPrice * 0.02;

      if (priceDiff < tolerance) {
        const valleyBetween = valleys.filter(
          (v) => v.index > lastTwoPeaks[0].index && v.index < lastTwoPeaks[1].index
        );
        if (valleyBetween.length > 0) {
          const valleyDepth = avgPrice - valleyBetween[0].value;
          if (valleyDepth > avgPrice * 0.01) {
            if (lastTwoPeaks[0].index < PATTERN_WINDOW * 0.5) {
              return { pattern: 'head_shoulders', confidence: 70, direction: 'SELL' };
            }
            return { pattern: 'double_top', confidence: 65, direction: 'SELL' };
          }
        }
      }
    }

    if (valleys.length >= 2) {
      const lastTwoValleys = valleys.slice(-2);
      const priceDiff = Math.abs(lastTwoValleys[0].value - lastTwoValleys[1].value);
      const avgPrice = (lastTwoValleys[0].value + lastTwoValleys[1].value) / 2;
      const tolerance = avgPrice * 0.02;

      if (priceDiff < tolerance) {
        const peakBetween = peaks.filter(
          (p) => p.index > lastTwoValleys[0].index && p.index < lastTwoValleys[1].index
        );
        if (peakBetween.length > 0) {
          const peakHeight = peakBetween[0].value - avgPrice;
          if (peakHeight > avgPrice * 0.01) {
            if (lastTwoValleys[0].index < PATTERN_WINDOW * 0.5) {
              return { pattern: 'inv_head_shoulders', confidence: 70, direction: 'BUY' };
            }
            return { pattern: 'double_bottom', confidence: 65, direction: 'BUY' };
          }
        }
      }
    }

    const last10 = recent.slice(-10);
    const isMonotonicUp = last10.every((p, i) => i === 0 || p >= last10[i - 1] * 0.999);
    const isMonotonicDown = last10.every((p, i) => i === 0 || p <= last10[i - 1] * 1.001);

    if (isMonotonicUp) {
      const slope = (last10[last10.length - 1] - last10[0]) / last10[0];
      if (slope > 0.005 && slope < 0.05) {
        return { pattern: 'flag_bull', confidence: 55, direction: 'BUY' };
      }
    }
    if (isMonotonicDown) {
      const slope = (last10[0] - last10[last10.length - 1]) / last10[0];
      if (slope > 0.005 && slope < 0.05) {
        return { pattern: 'flag_bear', confidence: 55, direction: 'SELL' };
      }
    }

    return { pattern: 'none', confidence: 0, direction: null };
  }

  generateAdaptiveSignal(
    prices: number[],
    baseConfidence: number,
    baseDirection: 'BUY' | 'SELL',
    symbol: string,
    baseStake: number
  ): AdaptiveSignal | null {
    const regime = this.detectRegime(prices);
    const pattern = this.detectPattern(prices);

    let adjustedConfidence = baseConfidence;
    let strategyName = 'multi-indicator';

    switch (regime.regime) {
      case 'trending_up':
        if (baseDirection === 'BUY') {
          adjustedConfidence *= 1.2;
          strategyName = 'trend-following';
        } else {
          adjustedConfidence *= 0.7;
          strategyName = 'counter-trend';
        }
        break;
      case 'trending_down':
        if (baseDirection === 'SELL') {
          adjustedConfidence *= 1.2;
          strategyName = 'trend-following';
        } else {
          adjustedConfidence *= 0.7;
          strategyName = 'counter-trend';
        }
        break;
      case 'volatile':
        adjustedConfidence *= 0.8;
        strategyName = 'volatility-scaled';
        break;
      case 'breakout':
        adjustedConfidence *= 1.1;
        strategyName = 'breakout';
        break;
      case 'ranging':
        if (baseConfidence > 70) {
          adjustedConfidence *= 1.05;
          strategyName = 'range-trading';
        }
        break;
    }

    if (pattern.pattern !== 'none' && pattern.direction === baseDirection) {
      adjustedConfidence *= 1.15;
      strategyName += `+${pattern.pattern}`;
    } else if (pattern.pattern !== 'none' && pattern.direction !== baseDirection) {
      adjustedConfidence *= 0.85;
    }

    const perfMultiplier = this.getPerformanceMultiplier(symbol, strategyName);
    adjustedConfidence *= perfMultiplier;

    const volMultiplier = 1 - (regime.volatility / 100) * 0.3;
    const adjustedStake = baseStake * Math.max(0.5, volMultiplier);

    adjustedConfidence = Math.min(100, Math.max(0, adjustedConfidence));

    if (adjustedConfidence < 50) {
      return null;
    }

    return {
      direction: baseDirection,
      confidence: Math.round(adjustedConfidence),
      strategy: strategyName,
      regime: regime.regime,
      patterns: pattern.pattern !== 'none' ? [pattern.pattern] : [],
      adjustedStake: Math.round(adjustedStake * 100) / 100,
    };
  }

  recordSignalOutcome(
    direction: 'BUY' | 'SELL',
    confidence: number,
    symbol: string,
    strategy: string,
    profit: number
  ): void {
    const outcome: 'win' | 'loss' = profit >= 0 ? 'win' : 'loss';

    this.signalHistory.push({
      direction,
      outcome,
      confidence,
      timestamp: Date.now(),
      symbol,
    });

    if (this.signalHistory.length > PERFORMANCE_WINDOW * 10) {
      this.signalHistory = this.signalHistory.slice(-PERFORMANCE_WINDOW * 5);
    }

    const perf = this.strategyPerformance.get(strategy) || {
      strategy,
      wins: 0,
      losses: 0,
      totalConfidence: 0,
      lastUpdated: Date.now(),
    };

    if (outcome === 'win') perf.wins++;
    else perf.losses++;
    perf.totalConfidence += confidence;
    perf.lastUpdated = Date.now();

    this.strategyPerformance.set(strategy, perf);
  }

  private getPerformanceMultiplier(symbol: string, strategy: string): number {
    const perf = this.strategyPerformance.get(strategy);
    if (!perf || perf.wins + perf.losses < 5) return 1;

    const winRate = perf.wins / (perf.wins + perf.losses);
    const avgConfidence = perf.totalConfidence / (perf.wins + perf.losses);

    if (winRate > 0.65) return 1.1;
    if (winRate > 0.55) return 1.05;
    if (winRate < 0.4) return 0.8;
    if (winRate < 0.45) return 0.9;
    return 1;
  }

  private calculateADX(prices: number[], period: number): number {
    if (prices.length < period + 1) return 0;

    const plusDM: number[] = [];
    const minusDM: number[] = [];
    const tr: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const upMove = prices[i] - prices[i - 1];
      const downMove = prices[i - 1] - prices[i];

      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
      tr.push(Math.max(
        Math.abs(prices[i] - prices[i - 1]),
        Math.abs(prices[i] - prices[i - 1]),
        Math.abs(prices[i - 1] - prices[i - 1])
      ));
    }

    if (tr.length < period) return 0;

    let smoothedTR = tr.slice(0, period).reduce((a, b) => a + b, 0);
    let smoothedPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
    let smoothedMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

    const dxValues: number[] = [];

    for (let i = period; i < tr.length; i++) {
      smoothedTR = smoothedTR - smoothedTR / period + tr[i];
      smoothedPlusDM = smoothedPlusDM - smoothedPlusDM / period + plusDM[i];
      smoothedMinusDM = smoothedMinusDM - smoothedMinusDM / period + minusDM[i];

      const plusDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
      const minusDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;
      const diSum = plusDI + minusDI;

      dxValues.push(diSum > 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0);
    }

    if (dxValues.length < period) return 0;

    let adx = dxValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < dxValues.length; i++) {
      adx = (adx * (period - 1) + dxValues[i]) / period;
    }

    return adx;
  }

  private sma(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1];
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  private ema(data: number[], period: number): number {
    if (data.length === 0) return 0;
    if (data.length < period) return data[data.length - 1];

    const multiplier = 2 / (period + 1);
    let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map((v) => Math.pow(v - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  }

  private findPeaks(data: number[]): { index: number; value: number }[] {
    const peaks: { index: number; value: number }[] = [];
    for (let i = 2; i < data.length - 2; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i - 2] && data[i] > data[i + 1] && data[i] > data[i + 2]) {
        peaks.push({ index: i, value: data[i] });
      }
    }
    return peaks;
  }

  private findValleys(data: number[]): { index: number; value: number }[] {
    const valleys: { index: number; value: number }[] = [];
    for (let i = 2; i < data.length - 2; i++) {
      if (data[i] < data[i - 1] && data[i] < data[i - 2] && data[i] < data[i + 1] && data[i] < data[i + 2]) {
        valleys.push({ index: i, value: data[i] });
      }
    }
    return valleys;
  }

  getStrategyStats(): StrategyPerformance[] {
    return Array.from(this.strategyPerformance.values()).sort(
      (a, b) => (b.wins / (b.wins + b.losses || 1)) - (a.wins / (a.wins + a.losses || 1))
    );
  }

  getOverallAccuracy(): number {
    const total = this.signalHistory.length;
    if (total === 0) return 0;
    const wins = this.signalHistory.filter((s) => s.outcome === 'win').length;
    return Math.round((wins / total) * 100);
  }

  getRecentRegime(): MarketRegime {
    if (this.regimeHistory.length === 0) return 'ranging';
    return this.regimeHistory[this.regimeHistory.length - 1].regime;
  }

  getRegimeHistory(): RegimeResult[] {
    return [...this.regimeHistory];
  }

  updateRegimeHistory(prices: number[]): void {
    const regime = this.detectRegime(prices);
    this.regimeHistory.push(regime);
    if (this.regimeHistory.length > 200) {
      this.regimeHistory = this.regimeHistory.slice(-100);
    }
  }
}
