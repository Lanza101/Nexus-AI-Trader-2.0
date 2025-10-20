import { MarketData, Candle, FootprintDataPoint, MarketPhase, BotConfig, AIAnalysisResult, TradingSession, OrderBookDataPoint, LiquidationLevel, OpenInterestDataPoint } from '../types';

const basePrices: { [key: string]: number } = {
  EURUSD: 1.0850,
  GBPUSD: 1.2700,
  USDJPY: 157.00,
  XAUUSD: 2350.00,
  XAGUSD: 30.50,
  BTCUSDT: 68000.00,
  ETHUSDT: 3800.00,
  SOLUSDT: 165.00,
  default: 50000,
};

const assetVolatility: { [key: string]: number } = {
  EURUSD: 0.0005,
  GBPUSD: 0.0006,
  USDJPY: 0.1,
  XAUUSD: 15,
  XAGUSD: 0.5,
  BTCUSDT: 500,
  ETHUSDT: 50,
  SOLUSDT: 5,
  default: 1000,
};

function generateRandomCandle(previousCandle: Candle, volatility: number): Candle {
  const time = previousCandle.time + 5000; // 5 seconds later
  const open = previousCandle.close;
  const priceChange = (Math.random() - 0.5) * volatility * 2;
  const close = open + priceChange;

  const high = Math.max(open, close) + Math.random() * volatility * 0.5;
  const low = Math.min(open, close) - Math.random() * volatility * 0.5;

  const volume = Math.random() * 100 + 50;
  const buyVolume = volume * (0.4 + Math.random() * 0.2); // 40-60% buy volume
  const sellVolume = volume - buyVolume;
  
  const footprint: FootprintDataPoint[] = [];
  const priceStep = (high - low) / (Math.random() * 10 + 5);
  let remainingBuyVolume = buyVolume;
  let remainingSellVolume = sellVolume;

  if (priceStep > 0) {
      for (let price = low; price <= high; price += priceStep) {
          const buyVol = Math.random() * remainingBuyVolume * 0.5;
          const sellVol = Math.random() * remainingSellVolume * 0.5;
          footprint.push({ price, buyVolume: buyVol, sellVolume: sellVol });
          remainingBuyVolume -= buyVol;
          remainingSellVolume -= sellVol;
      }
  }
  // Distribute any remaining volume
  if(footprint.length > 0) {
    footprint[Math.floor(Math.random()*footprint.length)].buyVolume += remainingBuyVolume;
    footprint[Math.floor(Math.random()*footprint.length)].sellVolume += remainingSellVolume;
  }

  return { time, open, high, low, close, volume, buyVolume, sellVolume, footprint };
}

function getCurrentTradingSession(): TradingSession {
    const now = new Date();
    const hourUTC = now.getUTCHours();

    const inAsia = hourUTC >= 0 && hourUTC < 8;
    const inLondon = hourUTC >= 7 && hourUTC < 16;
    const inNewYork = hourUTC >= 12 && hourUTC < 21;

    if (inLondon && inNewYork) return 'Overlap';
    if (inAsia && inLondon) return 'Overlap';
    if (inNewYork) return 'New York';
    if (inLondon) return 'London';
    if (inAsia) return 'Asia';

    return 'Closed';
}

export const generateSimulatedMarketData = (asset: string): MarketData => {
  const basePrice = basePrices[asset] || basePrices.default;
  const volatility = assetVolatility[asset] || assetVolatility.default;
  const candleHistory: Candle[] = [];
  const openInterestHistory: OpenInterestDataPoint[] = [];

  let lastCandle: Candle = {
    time: Date.now() - 100 * 5000,
    open: basePrice,
    high: basePrice,
    low: basePrice,
    close: basePrice * (1 + (Math.random() - 0.5) * 0.001),
    volume: 0,
    buyVolume: 0,
    sellVolume: 0,
  };

  let currentOI = 50000 + Math.random() * 10000;

  for (let i = 0; i < 100; i++) {
    const newCandle = generateRandomCandle(lastCandle, volatility);
    candleHistory.push(newCandle);
    currentOI += (newCandle.volume / 10) * (Math.random() - 0.45); // OI changes with volume
    openInterestHistory.push({ time: newCandle.time, value: currentOI });
    lastCandle = newCandle;
  }
  
  const currentPrice = lastCandle.close;
  
  const currentFootprint = lastCandle.footprint || [];
  
  const orderBook: { bids: OrderBookDataPoint[], asks: OrderBookDataPoint[] } = { bids: [], asks: [] };
  const priceStep = volatility * 0.2;
  for (let i = 1; i <= 20; i++) {
    orderBook.bids.push({ price: currentPrice - i * priceStep, size: Math.random() * 50 });
    orderBook.asks.push({ price: currentPrice + i * priceStep, size: Math.random() * 50 });
  }

  const liquidationLevels: { longs: LiquidationLevel[], shorts: LiquidationLevel[] } = { longs: [], shorts: [] };
  for (let i = 1; i <= 5; i++) {
    liquidationLevels.longs.push({ price: currentPrice - i * volatility * 2, amount: (Math.random() * 50 + 10) * 1e6 });
    liquidationLevels.shorts.push({ price: currentPrice + i * volatility * 2, amount: (Math.random() * 50 + 10) * 1e6 });
  }

  const cumulativeVolumeDelta = (Math.random() - 0.5) * 500;
  const totalVolume = candleHistory.reduce((sum, c) => sum + c.volume, 0) * 1000;
  
  const low24h = Math.min(...candleHistory.map(c => c.low)) * 0.99;
  const high24h = Math.max(...candleHistory.map(c => c.high)) * 1.01;

  const marketPhase: MarketPhase = Math.random() > 0.66 ? 'Uptrend' : Math.random() > 0.33 ? 'Downtrend' : 'Consolidation';
  
  const calculateEma = (data: Candle[], period: number): number => {
    const relevantData = data.slice(-period);
    if (relevantData.length === 0) return 0;
    const multiplier = 2 / (period + 1);
    let ema = relevantData[0].close;
    for (let i = 1; i < relevantData.length; i++) {
        ema = (relevantData[i].close * multiplier) + (ema * (1 - multiplier));
    }
    return ema;
  };
  
  const emas = { '9': calculateEma(candleHistory, 9), '21': calculateEma(candleHistory, 21), '50': calculateEma(candleHistory, 50) };

  return {
    price: parseFloat(currentPrice.toFixed(4)),
    volume: totalVolume,
    vwap: { '5m': currentPrice * 1.0001, '30m': currentPrice * 0.9998, '1h': currentPrice * 1.0002, '24h': currentPrice * 0.9995 },
    emas,
    support: parseFloat(low24h.toFixed(4)),
    resistance: parseFloat(high24h.toFixed(4)),
    candleHistory,
    cumulativeVolumeDelta,
    currentFootprint,
    marketPhase,
    orderBook,
    liquidationLevels,
    openInterest: currentOI,
    openInterestHistory,
    tradingSession: getCurrentTradingSession(),
  };
};

export const generateMockAnalysis = (marketData: MarketData, config: BotConfig): AIAnalysisResult => {
    const { price, candleHistory, tradingSession, liquidationLevels } = marketData;

    const tradeDirection: 'LONG' | 'SHORT' | 'NEUTRAL' = tradingSession === 'Asia' ? 'NEUTRAL' : (Math.random() > 0.5 ? 'LONG' : 'SHORT');
    let keyObservation: string;
    let confidence: 'Low' | 'Medium' = 'Low';

    if (tradeDirection === 'LONG') {
        keyObservation = `In the ${tradingSession} session, price is showing bullish momentum towards the short liquidation level at $${liquidationLevels.shorts[0].price.toFixed(2)}.`;
        confidence = 'Medium';
    } else if (tradeDirection === 'SHORT') {
        keyObservation = `During the volatile ${tradingSession} session, price is showing bearish pressure towards the long liquidation level at $${liquidationLevels.longs[0].price.toFixed(2)}.`;
        confidence = 'Medium';
    } else {
        keyObservation = `Market is consolidating during the ${tradingSession} session, awaiting a catalyst.`;
    }

    const riskAmount = config.accountBalance * (config.riskPercentage / 100);
    const stopLossDistance = price * 0.001;
    const takeProfitDistance = stopLossDistance * 1.5;

    const entryPrice = price;
    let stopLoss: number;
    let takeProfit: number;
    const decimals = price > 100 ? 2 : 4;

    if (tradeDirection === 'LONG') {
        stopLoss = entryPrice - stopLossDistance;
        takeProfit = entryPrice + takeProfitDistance;
    } else if (tradeDirection === 'SHORT') {
        stopLoss = entryPrice + stopLossDistance;
        takeProfit = entryPrice - stopLossDistance;
    } else { // NEUTRAL
        const speculativeDirection = Math.random() > 0.5 ? 'LONG' : 'SHORT';
        if (speculativeDirection === 'LONG') {
            stopLoss = entryPrice - stopLossDistance;
            takeProfit = entryPrice + takeProfitDistance;
            keyObservation = "Market is consolidating, but simulated order flow suggests a potential upward break.";
        } else {
            stopLoss = entryPrice + stopLossDistance;
            takeProfit = entryPrice - takeProfitDistance;
            keyObservation = "Range-bound market, but minor rejection at resistance hints at a possible drop.";
        }

        const positionSize = riskAmount / stopLossDistance;

        return {
            tradeDirection: 'NEUTRAL',
            speculativeDirection,
            keyObservation,
            entryPrice: parseFloat(entryPrice.toFixed(decimals)),
            stopLoss: parseFloat(stopLoss.toFixed(decimals)),
            takeProfit: parseFloat(takeProfit.toFixed(decimals)),
            positionSize,
            confidence: 'Low',
            nextActionableSignal: `Long breakout: Enter at ${(price * 1.002).toFixed(decimals)}, SL at ${(price * 0.999).toFixed(decimals)}, TP at ${(price * 1.005).toFixed(decimals)}. Short breakdown: Enter at ${(price * 0.998).toFixed(decimals)}, SL at ${(price * 1.001).toFixed(decimals)}, TP at ${(price * 0.995).toFixed(decimals)}.`,
            stopLossJustification: "Mock SL is placed based on a standard volatility factor from the current price.",
            takeProfitJustification: "Mock TP targets a 1.5:1 risk/reward ratio, a common scalping objective."
        };
    }

    const positionSize = riskAmount / stopLossDistance;

    return {
        tradeDirection,
        keyObservation,
        entryPrice: parseFloat(entryPrice.toFixed(decimals)),
        stopLoss: parseFloat(stopLoss.toFixed(decimals)),
        takeProfit: parseFloat(takeProfit.toFixed(decimals)),
        positionSize,
        confidence,
        nextActionableSignal: "Signal derived from simulated price action.",
        stopLossJustification: "Mock SL is placed based on a standard volatility factor from the current price.",
        takeProfitJustification: "Mock TP targets a 1.5:1 risk/reward ratio, a common scalping objective."
    };
};