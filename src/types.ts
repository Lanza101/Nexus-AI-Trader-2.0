export type MarketPhase = 'Uptrend' | 'Downtrend' | 'Consolidation';
export type TradingSession = 'Asia' | 'London' | 'New York' | 'Overlap' | 'Closed';

export interface Vwap {
  '5m': number;
  '30m': number;
  '1h': number;
  '24h': number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  footprint?: FootprintDataPoint[];
}

export interface FootprintDataPoint {
  price: number;
  buyVolume: number;
  sellVolume: number;
}

export interface OrderBookDataPoint {
  price: number;
  size: number;
}

export interface LiquidationLevel {
  price: number;
  amount: number; // in USD
}

export interface OpenInterestDataPoint {
  time: number;
  value: number;
}

export interface MarketData {
  price: number; // current price
  volume: number; // 24h volume
  vwap: Vwap;
  emas: {
    '9': number;
    '21': number;
    '50': number;
  };
  support: number;
  resistance: number;
  candleHistory: Candle[];
  cumulativeVolumeDelta: number;
  currentFootprint: FootprintDataPoint[];
  marketPhase: MarketPhase;
  // New institutional data points
  orderBook: {
    bids: OrderBookDataPoint[];
    asks: OrderBookDataPoint[];
  };
  liquidationLevels: {
    longs: LiquidationLevel[];
    shorts: LiquidationLevel[];
  };
  openInterest: number;
  openInterestHistory: OpenInterestDataPoint[];
  tradingSession: TradingSession;
}

export interface Trade {
  id: string;
  type: 'BUY' | 'SELL';
  price: number;
  size: number;
  timestamp: Date;
}

export interface BotConfig {
  leverage: number;
  riskPercentage: number;
  asset: string;
  accountBalance: number;
}

export interface TradeSignal {
  asset: string;
  action: 'BUY' | 'SELL';
  price: number;
  size: number;
  leverage: number;
  timestamp: string;
}

export interface AIAnalysisResult {
  tradeDirection: 'LONG' | 'SHORT' | 'NEUTRAL';
  speculativeDirection?: 'LONG' | 'SHORT';
  keyObservation: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  confidence: 'Low' | 'Medium' | 'High';
  nextActionableSignal: string;
  stopLossJustification: string;
  takeProfitJustification: string;
}

export interface AdjustmentFeedback {
  feedback: string;
}

export interface OptimizedTradePlan {
  newStopLoss: number;
  newTakeProfit: number;
  newPositionSize: number;
  explanation: string;
}