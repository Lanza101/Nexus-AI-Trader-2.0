
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MarketData, Trade, BotConfig, Candle, FootprintDataPoint, TradeSignal, AIAnalysisResult } from '../types';
import { getMarketAnalysis } from '../services/geminiService';
import { generateSimulatedMarketData, generateMockAnalysis } from '../services/marketSimulator';
import { MetricCard } from './MetricCard';
import { AIEngineIcon, ChartIcon, FootprintIcon, ArrowUpIcon, ArrowDownIcon, NeutralIcon, WebhookIcon, XCircleIcon, CheckCircleIcon } from './icons';
import { AdvancedPriceChart } from './AdvancedPriceChart';
import { CandlestickVolumeProfileChart } from './CandlestickVolumeProfileChart';
import { ControlPanel } from './ControlPanel';
import { TradePlacementPanel } from './TradePlacementPanel';
import { AnalysisPlaceholder } from './AnalysisPlaceholder';
import { VwapContextDisplay } from './VwapContextDisplay';
import { BreakoutPlansDisplay } from './BreakoutPlansDisplay';
import { AnchoredVwapChart } from './AnchoredVwapChart';

const CANDLE_INTERVAL_MS = 5000;
const PRICE_STEP = 0.5;
const ANALYSIS_COOLDOWN_S = 90;
const FALLBACK_RETRY_S = 90;
const BINANCE_ASSETS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'simulated';
type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error';
type NotificationType = { message: string, type: 'error' | 'success' };

const initialMarketData: MarketData = {
  price: 0,
  volume: 0,
  vwap: { '5m': 0, '30m': 0, '1h': 0, '24h': 0 },
  emas: { '9': 0, '21': 0, '50': 0 },
  support: 0, 
  resistance: 0,
  candleHistory: [],
  cumulativeVolumeDelta: 0,
  currentFootprint: [],
  marketPhase: 'Consolidation',
  orderBook: { bids: [], asks: [] },
  liquidationLevels: { longs: [], shorts: [] },
  openInterest: 0,
  openInterestHistory: [],
  tradingSession: 'Closed',
};

interface AggTrade { p: string; q: string; T: number; m: boolean; }

// Helper for live simulation
const assetVolatility: { [key: string]: number } = {
  EURUSD: 0.0005, GBPUSD: 0.0006, USDJPY: 0.1,
  XAUUSD: 15, XAGUSD: 0.5,
  BTCUSDT: 500, ETHUSDT: 50, SOLUSDT: 5,
  default: 1000,
};

function generateRandomCandle(previousCandle: Candle, volatility: number): Candle {
  const time = Date.now();
  const open = previousCandle.close;
  const priceChange = (Math.random() - 0.5) * volatility * 2;
  const close = open + priceChange;
  const high = Math.max(open, close) + Math.random() * volatility * 0.5;
  const low = Math.min(open, close) - Math.random() * volatility * 0.5;
  const volume = Math.random() * 100 + 50;
  const buyVolume = volume * (0.4 + Math.random() * 0.2);
  const sellVolume = volume - buyVolume;
  const footprint: FootprintDataPoint[] = [{ price: close, buyVolume, sellVolume }];
  return { time, open, high, low, close, volume, buyVolume, sellVolume, footprint };
}


export const Dashboard: React.FC = () => {
  const [marketData, setMarketData] = useState<MarketData>(initialMarketData);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [config, setConfig] = useState<BotConfig>({ leverage: 10, riskPercentage: 1, asset: 'BTCUSDT', accountBalance: 10000 });
  
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus>('idle');
  const [analysisMessage, setAnalysisMessage] = useState<string>('Select a trading pair and click "Get Analysis".');
  const [initialAnalysisDone, setInitialAnalysisDone] = useState(false);
  const [isInFallbackMode, setIsInFallbackMode] = useState(false);
  const [fallbackRetryTimer, setFallbackRetryTimer] = useState<number | null>(null);

  const [analysisCooldown, setAnalysisCooldown] = useState(0);
  const [latestSignal, setLatestSignal] = useState<TradeSignal | null>(null);
  const [high24h, setHigh24h] = useState(0);
  const [low24h, setLow24h] = useState(0);
  const [tradesPerMinute, setTradesPerMinute] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [notification, setNotification] = useState<NotificationType | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const cooldownTimerRef = useRef<number | null>(null);
  const lastClosePriceRef = useRef(0);
  const lastEmasRef = useRef({ '9': 0, '21': 0, '50': 0 });
  const latestPriceRef = useRef(0);
  const cumulativeVolumeDeltaRef = useRef(0);
  const tradesBatchRef = useRef<Trade[]>([]);
  const tradeCounterRef = useRef(0);
  const currentCandleRef = useRef<Candle | null>(null);
  const currentFootprintRef = useRef<Map<number, {buyVolume: number, sellVolume: number}>>(new Map());

  const previousPrice = useMemo(() => {
    return marketData.candleHistory.length > 1 
      ? marketData.candleHistory[marketData.candleHistory.length-2].close 
      : marketData.price;
  }, [marketData.candleHistory, marketData.price]);

  const getBinanceSymbol = (asset: string) => asset.toLowerCase();
    
  useEffect(() => {
    wsRef.current?.close();
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);

    const initialSimulatedData = generateSimulatedMarketData(config.asset);
    
    setMarketData(initialSimulatedData);
    setHigh24h(initialSimulatedData.resistance);
    setLow24h(initialSimulatedData.support);
    
    latestPriceRef.current = 0;
    cumulativeVolumeDeltaRef.current = 0;
    lastClosePriceRef.current = 0;
    lastEmasRef.current = { '9': 0, '21': 0, '50': 0 };
    setTrades([]);
    tradesBatchRef.current = [];
    currentFootprintRef.current.clear();
    currentCandleRef.current = null;
    setAnalysisCooldown(0);
    setAiAnalysis(null);
    setAnalysisStatus('idle');
    setAnalysisMessage(`Data source for ${config.asset} is being configured...`);
    setInitialAnalysisDone(false);
    setIsInFallbackMode(false);
    setFallbackRetryTimer(null);

    if (BINANCE_ASSETS.includes(config.asset)) {
        setConnectionStatus('connecting');
        const symbol = getBinanceSymbol(config.asset);
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol}@aggTrade`);
        wsRef.current = ws;

        ws.onopen = () => setConnectionStatus('connected');
        ws.onmessage = (event) => {
            const trade: AggTrade = JSON.parse(event.data);
            const price = parseFloat(trade.p);
            const volume = parseFloat(trade.q);
            const isBuy = !trade.m;
            
            tradeCounterRef.current += 1;
            latestPriceRef.current = price;

            if (!currentCandleRef.current) {
                const lastClose = lastClosePriceRef.current > 0 ? lastClosePriceRef.current : price;
                lastClosePriceRef.current = lastClose; // Ensure last close is set for finalizeCandle
                currentCandleRef.current = { time: Date.now(), open: lastClose, high: price, low: price, close: price, volume: 0, buyVolume: 0, sellVolume: 0 };
            }

            const candle = currentCandleRef.current;
            // First trade in a new candle sets the open price
            if (candle.volume === 0) {
              candle.open = price;
              candle.high = price;
              candle.low = price;
            }

            candle.close = price;
            candle.high = Math.max(candle.high, price);
            candle.low = Math.min(candle.low, price);
            candle.volume += volume;
            if (isBuy) candle.buyVolume += volume; else candle.sellVolume += volume;

            cumulativeVolumeDeltaRef.current += isBuy ? volume : -volume;

            const footprintPrice = Math.round(price / PRICE_STEP) * PRICE_STEP;
            const footprintEntry = currentFootprintRef.current.get(footprintPrice) || { buyVolume: 0, sellVolume: 0 };
            if (isBuy) footprintEntry.buyVolume += volume; else footprintEntry.sellVolume += volume;
            currentFootprintRef.current.set(footprintPrice, footprintEntry);
            
            tradesBatchRef.current.unshift({ id: `${trade.T}-${trade.p}`, type: isBuy ? 'BUY' : 'SELL', price, size: volume, timestamp: new Date(trade.T) });
        };
        ws.onerror = () => setConnectionStatus('error');
        ws.onclose = (event) => { if (!event.wasClean) setConnectionStatus('disconnected'); };
        
        return () => {
          if (ws) {
            ws.close();
          }
        };
    } else {
        setConnectionStatus('simulated');
    }
  }, [config.asset]);

  // UI update interval for high-frequency data
  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    const uiUpdateInterval = setInterval(() => {
      if (tradesBatchRef.current.length > 0) {
        setTrades(prev => [...tradesBatchRef.current, ...prev].slice(0, 50));
        tradesBatchRef.current = [];
      }
      if (latestPriceRef.current === 0) return;

      setMarketData(prevData => ({ ...prevData, price: latestPriceRef.current, cumulativeVolumeDelta: cumulativeVolumeDeltaRef.current }));
    }, 250);
    return () => clearInterval(uiUpdateInterval);
  }, [connectionStatus]);
  
  // Interval for order flow simulation in live mode
  useEffect(() => {
    if (connectionStatus !== 'connected') return;
    const orderFlowInterval = setInterval(() => {
      // Simulate new order flow data based on current price
      const simulatedFlow = generateSimulatedMarketData(config.asset);
      setMarketData(prev => ({
        ...prev,
        orderBook: simulatedFlow.orderBook,
        liquidationLevels: simulatedFlow.liquidationLevels,
        openInterest: simulatedFlow.openInterest,
        tradingSession: simulatedFlow.tradingSession,
        openInterestHistory: [...prev.openInterestHistory.slice(-99), { time: Date.now(), value: simulatedFlow.openInterest }]
      }));
    }, 5000); // Update every 5 seconds
    return () => clearInterval(orderFlowInterval);
  }, [connectionStatus, config.asset]);

  const finalizeCandle = useCallback(() => {
    if (connectionStatus !== 'connected') {
        return;
    }

    const candleInProgress = currentCandleRef.current;
    const lastPrice = candleInProgress?.open ?? lastClosePriceRef.current;

    // If there's no candle being built and no last known price, we can't do anything.
    // This only happens at the very start before any trades.
    if (!candleInProgress && lastPrice <= 0) {
        return;
    }

    let candleToAdd: Candle;

    // If there were trades in the interval, finalize the candle in progress.
    if (candleInProgress && candleInProgress.volume > 0) {
        const footprintData: FootprintDataPoint[] = [];
        currentFootprintRef.current.forEach((val, key) => footprintData.push({ price: key, ...val }));
        candleToAdd = { 
            ...candleInProgress, 
            time: candleInProgress.time, // Use start time of interval
            footprint: footprintData
        };
    } else {
        // No trades occurred in the interval. Create a placeholder candle.
        if (lastPrice > 0) {
            candleToAdd = {
                time: Date.now(),
                open: lastPrice,
                high: lastPrice,
                low: lastPrice,
                close: lastPrice,
                volume: 0,
                buyVolume: 0,
                sellVolume: 0,
                footprint: []
            };
        } else {
            // Should be rare, but if we have no price, we can't create a candle.
            return;
        }
    }
    
    lastClosePriceRef.current = candleToAdd.close;

    setMarketData(prevData => {
        const newHistory = [...prevData.candleHistory.slice(-99), candleToAdd];
        const calculateEma = (data: Candle[], period: number, lastEma: number): number => {
            if (data.length === 0) return 0;
            const multiplier = 2 / (period + 1);
            if (lastEma === 0 || data.length < period) {
                const relevantData = data.slice(-period);
                return relevantData.reduce((acc, val) => acc + val.close, 0) / relevantData.length;
            }
            return (data[data.length - 1].close * multiplier) + (lastEma * (1 - multiplier));
        };
        const newEmas = {
            '9': calculateEma(newHistory, 9, lastEmasRef.current['9']),
            '21': calculateEma(newHistory, 21, lastEmasRef.current['21']),
            '50': calculateEma(newHistory, 50, lastEmasRef.current['50']),
        };
        lastEmasRef.current = newEmas;
        if (newHistory.length > 1) {
            setHigh24h(Math.max(...newHistory.map(c => c.high)));
            setLow24h(Math.min(...newHistory.map(c => c.low)));
        }

        return { 
            ...prevData, 
            candleHistory: newHistory, 
            emas: newEmas, 
            currentFootprint: candleToAdd.footprint || []
        };
    });
    
    currentCandleRef.current = {
        time: Date.now(),
        open: candleToAdd.close,
        high: candleToAdd.close,
        low: candleToAdd.close,
        close: candleToAdd.close,
        volume: 0,
        buyVolume: 0,
        sellVolume: 0,
    };
    currentFootprintRef.current.clear();
  }, [connectionStatus]);

  useEffect(() => {
    const candleInterval = setInterval(finalizeCandle, CANDLE_INTERVAL_MS);
    return () => clearInterval(candleInterval);
  }, [finalizeCandle]);

  // New Effect for Live Simulation
  useEffect(() => {
    if (connectionStatus !== 'simulated') return;

    const simulationInterval = setInterval(() => {
      setMarketData(prevData => {
        if (prevData.candleHistory.length === 0) return prevData;

        const lastCandle = prevData.candleHistory[prevData.candleHistory.length - 1];
        const volatility = assetVolatility[config.asset] || assetVolatility.default;
        const newCandle = generateRandomCandle(lastCandle, volatility);
        const newHistory = [...prevData.candleHistory.slice(-99), newCandle];

        const calculateEma = (data: Candle[], period: number, lastEma: number): number => {
            if (data.length === 0) return 0;
            const multiplier = 2 / (period + 1);
            if (lastEma === 0 || data.length < period) {
                const relevantData = data.slice(-period);
                if (relevantData.length === 0) return 0;
                return relevantData.reduce((acc, val) => acc + val.close, 0) / relevantData.length;
            }
            return (data[data.length - 1].close * multiplier) + (lastEma * (1 - multiplier));
        };

        const newEmas = {
            '9': calculateEma(newHistory, 9, prevData.emas['9'] || 0),
            '21': calculateEma(newHistory, 21, prevData.emas['21'] || 0),
            '50': calculateEma(newHistory, 50, prevData.emas['50'] || 0),
        };

        const newCVD = prevData.cumulativeVolumeDelta + (newCandle.buyVolume - newCandle.sellVolume);
        const newOI = Math.max(0, prevData.openInterest + (newCandle.volume / 10) * (Math.random() - 0.45));
        
        setHigh24h(prev => Math.max(prev, newCandle.high));
        setLow24h(prev => Math.min(prev, newCandle.low));
        
        const priceStep = volatility * 0.2;
        const newBids = Array.from({ length: 20 }, (_, i) => ({ price: newCandle.close - (i + 1) * priceStep, size: Math.random() * 50 }));
        const newAsks = Array.from({ length: 20 }, (_, i) => ({ price: newCandle.close + (i + 1) * priceStep, size: Math.random() * 50 }));

        return {
          ...prevData,
          price: newCandle.close,
          candleHistory: newHistory,
          emas: newEmas,
          cumulativeVolumeDelta: newCVD,
          openInterest: newOI,
          openInterestHistory: [...prevData.openInterestHistory.slice(-99), { time: newCandle.time, value: newOI }],
          orderBook: { bids: newBids, asks: newAsks },
        };
      });
    }, CANDLE_INTERVAL_MS);

    return () => clearInterval(simulationInterval);
  }, [connectionStatus, config.asset]);

  useEffect(() => {
    if (connectionStatus !== 'connected') { setTradesPerMinute(0); return; };
    const tpmInterval = setInterval(() => { setTradesPerMinute(tradeCounterRef.current * 12); tradeCounterRef.current = 0; }, 5000);
    return () => clearInterval(tpmInterval);
  }, [connectionStatus]);

  useEffect(() => {
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    if (analysisCooldown > 0) {
      cooldownTimerRef.current = window.setTimeout(() => setAnalysisCooldown(prev => prev - 1), 1000);
    } else if (analysisStatus === 'error' && !isInFallbackMode) {
      setAnalysisStatus('idle'); setAnalysisMessage('Cooldown finished. Ready for new analysis.');
    }
  }, [analysisCooldown, analysisStatus, isInFallbackMode]);

   useEffect(() => {
    if (fallbackRetryTimer !== null && fallbackRetryTimer > 0) {
      const timerId = setTimeout(() => setFallbackRetryTimer(t => (t ? t - 1 : null)), 1000);
      return () => clearTimeout(timerId);
    } else if (fallbackRetryTimer === 0) {
        setFallbackRetryTimer(null); setIsInFallbackMode(false); setAnalysisCooldown(0);
        setAnalysisStatus('idle'); setAnalysisMessage('Attempting to reconnect to Gemini AI...');
        setNotification({ message: 'Rate limit period ended. Reconnecting...', type: 'success' });
        handleAnalysisRequest();
    }
  }, [fallbackRetryTimer]);

  useEffect(() => {
    if (notification) {
        const timer = setTimeout(() => setNotification(null), 5000);
        return () => clearTimeout(timer);
    }
  }, [notification]);
  
  const handleAnalysisRequest = useCallback(async () => {
    if (analysisStatus === 'loading' || (analysisCooldown > 0 && fallbackRetryTimer === null) ) return;

    if (isInFallbackMode) {
        setAnalysisStatus('loading'); setAiAnalysis(null); setAnalysisMessage('Generating simulated analysis...');
        setTimeout(() => {
            const dataForAnalysis = generateSimulatedMarketData(config.asset);
            if (connectionStatus === 'simulated') setMarketData(dataForAnalysis);
            setAnalysisStatus('success'); setAiAnalysis(generateMockAnalysis(dataForAnalysis, config));
            setAnalysisMessage(''); setAnalysisCooldown(15); 
        }, 500);
        return;
    }

    let dataForAnalysis = marketData;
    if (connectionStatus === 'simulated') {
      dataForAnalysis = generateSimulatedMarketData(config.asset);
      setMarketData(dataForAnalysis);
    }

    if (dataForAnalysis.candleHistory.length < 10) { setAnalysisStatus('error'); setAnalysisMessage("Not enough market data. Please wait."); return; }

    setAnalysisStatus('loading'); setAiAnalysis(null); setAnalysisMessage('Gemini AI is analyzing market conditions...');
    const result = await getMarketAnalysis(dataForAnalysis, config);
    if (typeof result === 'string') {
        if (result === "RATE_LIMIT_EXCEEDED") {
            if (!isInFallbackMode) {
                setIsInFallbackMode(true); setFallbackRetryTimer(FALLBACK_RETRY_S);
                setNotification({ message: "API rate limit hit. Switched to Fallback Mode.", type: 'error' });
            }
            setAnalysisStatus('error'); setAnalysisMessage("API rate limit exceeded. Using simulated analysis. Retrying automatically...");
        } else {
            setAnalysisStatus('error'); setAnalysisMessage(result);
        }
    } else {
        if (isInFallbackMode) { setNotification({ message: 'Successfully reconnected to Gemini AI!', type: 'success' }); }
        setIsInFallbackMode(false); setFallbackRetryTimer(null); setAnalysisStatus('success');
        setAiAnalysis(result); setAnalysisMessage('');
        if (result.tradeDirection !== 'NEUTRAL') {
            setLatestSignal({ asset: config.asset, action: result.tradeDirection, price: result.entryPrice, size: result.positionSize, leverage: config.leverage, timestamp: new Date().toISOString() });
        }
    }
    if (!isInFallbackMode) { setAnalysisCooldown(ANALYSIS_COOLDOWN_S); }
  }, [marketData, config, connectionStatus, analysisStatus, analysisCooldown, isInFallbackMode, fallbackRetryTimer]);
  
  useEffect(() => {
    if (!initialAnalysisDone && analysisStatus === 'idle' && analysisCooldown === 0 && marketData.candleHistory.length >= 10) {
      handleAnalysisRequest();
      setInitialAnalysisDone(true);
    }
  }, [connectionStatus, marketData.candleHistory.length, initialAnalysisDone, analysisStatus, analysisCooldown, handleAnalysisRequest]);


  const getButtonText = () => {
    if (analysisStatus === 'loading') return 'Analyzing...';
    if (fallbackRetryTimer !== null && fallbackRetryTimer > 0) return `Retrying in ${fallbackRetryTimer}s`;
    if (analysisCooldown > 0) return `On Cooldown (${analysisCooldown}s)`;
    return isInFallbackMode ? 'Get Mock Analysis' : 'Get Analysis';
  };
  
  const isButtonDisabled = analysisStatus === 'loading' || (analysisCooldown > 0 && !isInFallbackMode && fallbackRetryTimer === null);

  const StatusIndicator = () => {
    const statusMap: { [key in ConnectionStatus]: { color: string, text: string, pulse: boolean } } = {
        connecting: { color: 'bg-yellow-500', text: 'Connecting...', pulse: true },
        connected: { color: 'bg-green-500', text: 'Live', pulse: false },
        disconnected: { color: 'bg-gray-500', text: 'Offline', pulse: false },
        error: { color: 'bg-red-500', text: 'Error', pulse: false },
        simulated: { color: 'bg-indigo-500', text: 'Simulated', pulse: false }
    };

    const currentStatus = statusMap[connectionStatus];

    return (
        <span className="flex items-center ml-2" title={currentStatus.text}>
            <span className={`relative flex h-2 w-2`}>
                {currentStatus.pulse && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${currentStatus.color} opacity-75`}></span>}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${currentStatus.color}`}></span>
            </span>
        </span>
    );
  };

  const AnalysisResultDisplay = ({ analysis }: { analysis: AIAnalysisResult }) => {
    const directionColor = analysis.tradeDirection === 'LONG' ? 'bg-green-600' : analysis.tradeDirection === 'SHORT' ? 'bg-red-600' : 'bg-gray-600';
    const confidenceColor = analysis.confidence === 'High' ? 'text-green-400' : analysis.confidence === 'Medium' ? 'text-yellow-400' : 'text-gray-300';
    const priceDecimals = analysis.entryPrice > 100 ? 2 : 4;

    return (
        <div className="space-y-4 text-sm">
            <div className={`p-3 rounded-lg text-center font-bold text-lg text-white flex items-center justify-center ${directionColor}`}>
                {analysis.tradeDirection === 'LONG' && <ArrowUpIcon className="mr-2 h-5 w-5" />}
                {analysis.tradeDirection === 'SHORT' && <ArrowDownIcon className="mr-2 h-5 w-5" />}
                {analysis.tradeDirection === 'NEUTRAL' && <NeutralIcon className="mr-2 h-5 w-5" />}
                {analysis.tradeDirection}
            </div>
            <div className="bg-gray-900/50 p-3 rounded-lg">
                <p className="text-gray-400 font-semibold mb-1">Key Observation:</p>
                <p className="text-gray-200">{analysis.keyObservation}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="md:col-span-2 grid grid-cols-2 gap-x-4 gap-y-3">
                    <div><p className="text-gray-400 text-xs">Confidence</p><p className={`font-semibold ${confidenceColor}`}>{analysis.confidence}</p></div>
                    <div><p className="text-gray-400 text-xs">Entry Price</p><p className="font-mono text-white">${analysis.entryPrice.toFixed(priceDecimals)}</p></div>
                    <div><p className="text-green-400 text-xs">Take Profit</p><p className="font-mono text-green-400 font-semibold">${analysis.takeProfit.toFixed(priceDecimals)}</p></div>
                    <div><p className="text-red-400 text-xs">Stop Loss</p><p className="font-mono text-red-400 font-semibold">${analysis.stopLoss.toFixed(priceDecimals)}</p></div>
                    <div className="col-span-2"><p className="text-gray-400 text-xs">Position Size</p><p className="font-mono text-white">{analysis.positionSize.toFixed(4)}</p></div>
                </div>
                <div className="md:col-span-3 space-y-3 bg-gray-900/50 p-3 rounded-lg">
                     <div><p className="text-red-400 font-semibold text-xs mb-1">Stop Loss Rationale:</p><p className="text-gray-300">{analysis.stopLossJustification}</p></div>
                     <div><p className="text-green-400 font-semibold text-xs mb-1">Take Profit Rationale:</p><p className="text-gray-300">{analysis.takeProfitJustification}</p></div>
                </div>
            </div>
        </div>
    );
};

  const formatAssetForDisplay = (asset: string) => {
    if (asset.includes('USDT')) return asset.replace('USDT', '/USDT');
    if (asset.length === 6) return `${asset.slice(0, 3)}/${asset.slice(3)}`;
    return asset;
  };

  const Notification = () => {
    if (!notification) return null;
    const isError = notification.type === 'error';
    const Icon = isError ? XCircleIcon : CheckCircleIcon;

    return (
        <div className={`fixed top-5 right-5 z-50 flex items-center p-4 mb-4 text-sm rounded-lg shadow-lg ${isError ? 'bg-red-900/90 text-red-300 border border-red-700' : 'bg-green-900/90 text-green-300 border border-green-700'}`} role="alert">
            <Icon className="h-5 w-5 mr-3"/>
            <span className="font-medium">{notification.message}</span>
        </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <Notification />
      <div className="lg:col-span-4 space-y-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <MetricCard title={<div className="flex items-center"><span>{formatAssetForDisplay(config.asset)}</span><StatusIndicator /></div>} value={`$${(marketData.price ?? 0).toFixed(2)}`} change={marketData.price - previousPrice} changeType="value"/>
            <MetricCard title="24h Volume" value={`$${((marketData.volume ?? 0) / 1_000_000).toFixed(2)}M`} />
            <MetricCard title="24h High" value={`$${(high24h ?? 0).toFixed(2)}`} />
            <MetricCard title="24h Low" value={`$${(low24h ?? 0).toFixed(2)}`} />
            <MetricCard title="Trades/min" value={tradesPerMinute.toFixed(0)} />
            <MetricCard title="CVD" value={(marketData.cumulativeVolumeDelta ?? 0).toFixed(2)} />
            <MetricCard title="Open Interest" value={((marketData.openInterest ?? 0) / 1_000).toFixed(1) + 'k'} />
            <MetricCard title="Session" value={marketData.tradingSession} />
          </div>
          <VwapContextDisplay vwap={marketData.vwap} price={marketData.price} />
          <BreakoutPlansDisplay analysis={aiAnalysis} />
        </div>
        
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg h-[360px] flex flex-col">
           <h2 className="text-lg font-semibold text-white mb-2 -mt-2 flex items-center"><ChartIcon className="mr-2 h-5 w-5"/>Live Market Overview</h2>
           <div className="flex-grow min-h-0">
              <AdvancedPriceChart 
                priceData={marketData.candleHistory}
                oiData={marketData.openInterestHistory}
                liquidationLevels={marketData.liquidationLevels}
                session={marketData.tradingSession}
                isLive={connectionStatus === 'connected'} 
              />
           </div>
        </div>

        <div className="h-[360px]">
          {marketData.candleHistory.length > 10 ? (
            <CandlestickVolumeProfileChart data={marketData.candleHistory} />
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-800 p-4 rounded-lg shadow-lg">
                <p className="text-gray-500">Awaiting historical volume data...</p>
            </div>
          )}
        </div>

        <div className="bg-gray-800 p-4 rounded-lg shadow-lg h-[360px] flex flex-col">
           <AnchoredVwapChart data={marketData.candleHistory} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg lg:col-span-2 h-full flex flex-col">
                <div className="flex-grow">
                    <div className="flex justify-between items-center mb-3">
                        <h2 className="text-xl font-semibold flex items-center"><AIEngineIcon className="mr-2"/>Gemini Trade Analysis</h2>
                        <button onClick={handleAnalysisRequest} disabled={isButtonDisabled} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 text-sm">{getButtonText()}</button>
                    </div>
                    {analysisStatus === 'loading' ? <div className="text-center text-gray-400 space-y-2"><p>{analysisMessage}</p><div className="space-y-4 animate-pulse-fast mt-4"><div className="h-4 bg-gray-700 rounded w-3/4 mx-auto"></div><div className="h-8 bg-gray-700 rounded w-full"></div><div className="h-4 bg-gray-700 rounded w-1/2 mx-auto"></div></div></div>
                    : analysisStatus === 'success' && aiAnalysis ? <AnalysisResultDisplay analysis={aiAnalysis} />
                    : <AnalysisPlaceholder message={analysisMessage} isError={analysisStatus === 'error'}/>}
                </div>
            </div>
            <TradePlacementPanel analysis={aiAnalysis} config={config} currentPrice={marketData.price} marketData={marketData} />
        </div>
      </div>

      <div className="lg:col-span-1">
        <ControlPanel 
            config={config} 
            setConfig={setConfig} 
            latestSignal={latestSignal}
            trades={trades}
            marketData={marketData}
            connectionStatus={connectionStatus}
        />
      </div>
    </div>
  );
};
