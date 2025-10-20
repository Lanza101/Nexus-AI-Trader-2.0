import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AIAnalysisResult, BotConfig, MarketData } from '../types';
import { getTradeAdjustmentAnalysis, getOptimizedTradePlan } from '../services/geminiService';
import { WebhookIcon, AIEngineIcon, CheckCircleIcon, WarningIcon } from './icons';

interface TradePlacementPanelProps {
  analysis: AIAnalysisResult | null;
  config: BotConfig;
  currentPrice: number;
  marketData: MarketData;
}

export const TradePlacementPanel: React.FC<TradePlacementPanelProps> = ({ analysis, config, currentPrice, marketData }) => {
    const [activeTab, setActiveTab] = useState<'Market' | 'Limit' | 'Stop'>('Market');
    
    // State for all editable fields
    const [units, setUnits] = useState('');
    const [margin, setMargin] = useState(0);
    
    const [isTpActive, setIsTpActive] = useState(true);
    const [takeProfitPrice, setTakeProfitPrice] = useState('');
    const [takeProfitPips, setTakeProfitPips] = useState('');
    const [takeProfitAmount, setTakeProfitAmount] = useState('');

    const [isSlActive, setIsSlActive] = useState(true);
    const [stopLossPrice, setStopLossPrice] = useState('');
    const [stopLossPips, setStopLossPips] = useState('');
    const [stopLossAmount, setStopLossAmount] = useState('');
    
    const [adjustmentFeedback, setAdjustmentFeedback] = useState<string | null>(null);
    const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
    const debounceTimeoutRef = useRef<number | null>(null);

    // New state for Strategy Optimizer
    const [strategyComment, setStrategyComment] = useState('');
    const [strategyFeedback, setStrategyFeedback] = useState<string | null>(null);
    const [isStrategyLoading, setIsStrategyLoading] = useState(false);

    const effectiveDirection = analysis 
        ? analysis.tradeDirection === 'NEUTRAL' 
            ? analysis.speculativeDirection 
            : analysis.tradeDirection
        : null;

    const isLong = effectiveDirection === 'LONG';
    const entryPrice = analysis?.entryPrice ?? currentPrice;
    const decimals = entryPrice > 100 ? 2 : 4;

    const populateTradePlan = useCallback((
        newUnits: number,
        newStopLoss: number,
        newTakeProfit: number,
        entry: number
    ) => {
        const stopLossDistance = Math.abs(entry - newStopLoss);
        const riskAmount = stopLossDistance * newUnits;
        const potentialProfit = Math.abs(newTakeProfit - entry) * newUnits;
        const newMargin = (newUnits * entry) / config.leverage;

        setUnits(newUnits.toFixed(4));
        setMargin(newMargin);
        
        setIsTpActive(true);
        setTakeProfitPrice(newTakeProfit.toFixed(decimals));
        setTakeProfitPips(Math.abs(newTakeProfit - entry).toFixed(decimals));
        setTakeProfitAmount(potentialProfit.toFixed(2));
        
        setIsSlActive(true);
        setStopLossPrice(newStopLoss.toFixed(decimals));
        setStopLossPips(stopLossDistance.toFixed(decimals));
        setStopLossAmount(riskAmount.toFixed(2));
    }, [config.leverage, decimals]);

    useEffect(() => {
        if (analysis && effectiveDirection && entryPrice > 0) {
            populateTradePlan(analysis.positionSize, analysis.stopLoss, analysis.takeProfit, entryPrice);
            setAdjustmentFeedback(null);
            setStrategyFeedback(null);
        } else {
            setUnits(''); setMargin(0);
            setTakeProfitPrice(''); setTakeProfitPips(''); setTakeProfitAmount('');
            setStopLossPrice(''); setStopLossPips(''); setStopLossAmount('');
            setAdjustmentFeedback(null);
            setStrategyFeedback(null);
        }
    }, [analysis, config, effectiveDirection, entryPrice, populateTradePlan]);
    
    const handleManualChange = (newTp: string, newSl: string) => {
        if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
        setAdjustmentFeedback(null);

        debounceTimeoutRef.current = window.setTimeout(async () => {
            if (!analysis || !marketData) return;
            
            const newTpNum = parseFloat(newTp);
            const newSlNum = parseFloat(newSl);

            if (newTpNum > 0 && newSlNum > 0 && (newTpNum !== analysis.takeProfit || newSlNum !== analysis.stopLoss)) {
                setIsFeedbackLoading(true);
                const feedbackResult = await getTradeAdjustmentAnalysis(analysis, newSlNum, newTpNum, marketData);
                if (typeof feedbackResult === 'string') {
                    setAdjustmentFeedback(`Error: ${feedbackResult}`);
                } else {
                    setAdjustmentFeedback(feedbackResult.feedback);
                }
                setIsFeedbackLoading(false);
            }
        }, 1500);
    };

    const handleOptimizeRequest = async () => {
        if (!strategyComment || !analysis) return;
        setIsStrategyLoading(true);
        setStrategyFeedback(null);
        const result = await getOptimizedTradePlan(strategyComment, analysis, marketData, config);
        if (typeof result === 'string') {
            setStrategyFeedback(`Error: ${result}`);
        } else {
            populateTradePlan(result.newPositionSize, result.newStopLoss, result.newTakeProfit, entryPrice);
            setStrategyFeedback(result.explanation);
        }
        setIsStrategyLoading(false);
    };

    const handleUnitsChange = (value: string) => {
        if (!/^\d*\.?\d*$/.test(value)) return;
        setUnits(value);
        const unitsValue = parseFloat(value) || 0;
        setMargin((unitsValue * entryPrice) / config.leverage);
        const tpPrice = parseFloat(takeProfitPrice) || 0;
        const slPrice = parseFloat(stopLossPrice) || 0;
        if (tpPrice > 0) setTakeProfitAmount((Math.abs(tpPrice - entryPrice) * unitsValue).toFixed(2));
        if (slPrice > 0) setStopLossAmount((Math.abs(slPrice - entryPrice) * unitsValue).toFixed(2));
    };

    const updateUnitsAndDependents = (newUnits: number) => {
        setUnits(newUnits.toFixed(4));
        setMargin((newUnits * entryPrice) / config.leverage);
        const tpPrice = parseFloat(takeProfitPrice) || 0;
        if (tpPrice > 0) setTakeProfitAmount((Math.abs(tpPrice - entryPrice) * newUnits).toFixed(2));
    };

    const handlePriceChange = (type: 'tp' | 'sl', value: string) => {
        if (!/^\d*\.?\d*$/.test(value) || !entryPrice) return;
        const priceValue = parseFloat(value) || 0;
        const pips = Math.abs(priceValue - entryPrice);

        if (type === 'tp') {
            setTakeProfitPrice(value); setTakeProfitPips(pips.toFixed(decimals));
            setTakeProfitAmount((pips * (parseFloat(units) || 0)).toFixed(2));
            handleManualChange(value, stopLossPrice);
        } else {
            setStopLossPrice(value); setStopLossPips(pips.toFixed(decimals));
            const risk = parseFloat(stopLossAmount) || 0;
            if (pips > 0 && risk > 0) updateUnitsAndDependents(risk / pips);
            handleManualChange(takeProfitPrice, value);
        }
    };

    const handlePipsChange = (type: 'tp' | 'sl', value: string) => {
        if (!/^\d*\.?\d*$/.test(value) || !entryPrice) return;
        const pips = parseFloat(value) || 0;
        const newPrice = isLong 
            ? (type === 'tp' ? entryPrice + pips : entryPrice - pips)
            : (type === 'tp' ? entryPrice - pips : entryPrice + pips);

        if (type === 'tp') {
            setTakeProfitPips(value); setTakeProfitPrice(newPrice.toFixed(decimals));
            setTakeProfitAmount((pips * (parseFloat(units) || 0)).toFixed(2));
            handleManualChange(newPrice.toFixed(decimals), stopLossPrice);
        } else {
            setStopLossPips(value); setStopLossPrice(newPrice.toFixed(decimals));
            const risk = parseFloat(stopLossAmount) || 0;
            if (pips > 0 && risk > 0) updateUnitsAndDependents(risk / pips);
            handleManualChange(takeProfitPrice, newPrice.toFixed(decimals));
        }
    };

    const handleAmountChange = (type: 'tp' | 'sl', value: string) => {
        if (!/^\d*\.?\d*$/.test(value) || !entryPrice) return;
        const amount = parseFloat(value) || 0;
        const unitsValue = parseFloat(units) || 0;

        if (type === 'tp') {
            setTakeProfitAmount(value);
            if (unitsValue > 0) {
                const pips = amount / unitsValue;
                const newPrice = isLong ? entryPrice + pips : entryPrice - pips;
                setTakeProfitPips(pips.toFixed(decimals)); setTakeProfitPrice(newPrice.toFixed(decimals));
                handleManualChange(newPrice.toFixed(decimals), stopLossPrice);
            }
        } else {
            setStopLossAmount(value);
            const pips = parseFloat(stopLossPips) || 0;
            if (pips > 0 && amount > 0) updateUnitsAndDependents(amount / pips);
            handleManualChange(takeProfitPrice, stopLossPrice);
        }
    };

    const spread = currentPrice * 0.0001;
    const sellPrice = (currentPrice - spread / 2).toFixed(decimals);
    const buyPrice = (currentPrice + spread / 2).toFixed(decimals);

    const renderPlaceholder = (title: string, subtitle: string, nextSignal?: string) => (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg h-full flex flex-col">
          <h2 className="text-xl font-semibold mb-2">Trade Execution</h2>
          <div className="flex-grow flex items-center justify-center text-center bg-gray-900 rounded-lg p-4">
            <div className="space-y-4">
              <div>
                <p className="text-gray-400 font-semibold">{title}</p>
                <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
              </div>
              {nextSignal && (
                <div className="text-left text-sm border-t border-gray-700 pt-3">
                   <p className="text-indigo-400 font-semibold flex items-center mb-1"><WebhookIcon className="h-4 w-4 mr-2"/>Next Signal:</p>
                   <p className="text-gray-300">{nextSignal}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    
    const FeedbackDisplay = ({ feedback, isLoading }: { feedback: string | null; isLoading: boolean; }) => {
        if (isLoading) {
            return (
                <div className="flex items-center text-sm text-indigo-400 mt-3 p-2 bg-indigo-500/10 rounded-md">
                    <AIEngineIcon className="h-4 w-4 mr-2 animate-pulse" />
                    <span>AI is analyzing...</span>
                </div>
            );
        }

        if (!feedback) return null;

        const isWarning = feedback.toLowerCase().startsWith('warning') || feedback.toLowerCase().startsWith('error');
        const Icon = isWarning ? WarningIcon : CheckCircleIcon;
        return (
            <div className={`flex items-start text-sm mt-3 p-2 rounded-md ${isWarning ? 'bg-yellow-500/10 text-yellow-300' : 'bg-green-500/10 text-green-300'}`}>
                <Icon className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <span>{feedback}</span>
            </div>
        );
    }

    if (!analysis || !effectiveDirection) {
        return renderPlaceholder(
            analysis ? "Neutral Signal: Stand By" : "Awaiting Analysis",
            analysis ? (analysis.keyObservation || "AI recommends staying out of the market.") : "Click 'Get Analysis' to generate a trade signal.",
            analysis?.nextActionableSignal
        );
    }
    
    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg text-sm h-full flex flex-col">
            <div className="flex-grow overflow-y-auto pr-2">
                <div className="flex justify-between items-center bg-gray-900 p-2 rounded-md">
                    <div className="text-left">
                        <span className="text-gray-400 block text-xs">SELL</span>
                        <span className="text-red-400 font-bold text-lg">{sellPrice}</span>
                    </div>
                    <div className="text-gray-400 border border-gray-600 px-2 py-1 rounded-md text-xs">
                        {spread.toFixed(2)}
                    </div>
                    <div className="text-right">
                        <span className="text-gray-400 block text-xs">BUY</span>
                        <span className="text-green-400 font-bold text-lg">{buyPrice}</span>
                    </div>
                </div>

                <div className="flex border-b border-gray-700 mt-4">
                    {['Market', 'Limit', 'Stop'].map(tab => (
                        <button key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 -mb-px border-b-2 font-semibold ${activeTab === tab ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
                            disabled={tab !== 'Market'}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="mt-4">
                    <div className="grid grid-cols-2 gap-4 text-gray-400 mb-1">
                        <label htmlFor="units">Units ({config.asset.replace('USDT', '')})</label>
                        <label className="text-right">Margin (USD)</label>
                    </div>
                    <div className="flex items-center bg-gray-700 border border-gray-600 rounded-md focus-within:ring-2 focus-within:ring-indigo-500">
                      <input type="text" id="units" value={units} onChange={(e) => handleUnitsChange(e.target.value)} className="w-1/2 bg-transparent outline-none text-white font-mono p-2" />
                      <div className="border-r border-gray-600 h-6"></div>
                      <span className="w-1/2 bg-transparent outline-none text-white font-mono p-2 text-right">{margin.toFixed(2)}</span>
                    </div>
                </div>

                {/* Strategy Optimizer Section */}
                <div className="mt-4 border-t border-gray-700 pt-3">
                    <h3 className="text-gray-300 font-semibold mb-2 flex items-center">
                        <AIEngineIcon className="h-5 w-5 mr-2 text-indigo-400"/> Strategy Optimizer
                    </h3>
                    <textarea
                        value={strategyComment}
                        onChange={(e) => setStrategyComment(e.target.value)}
                        placeholder="Enter a constraint or goal, e.g., 'I have a prop firm account and can only risk $100 on this trade.'"
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[60px] resize-y"
                    />
                    <button
                        onClick={handleOptimizeRequest}
                        disabled={isStrategyLoading || !strategyComment}
                        className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300 text-sm"
                    >
                        {isStrategyLoading ? 'Optimizing...' : 'AI Optimize'}
                    </button>
                    <FeedbackDisplay feedback={strategyFeedback} isLoading={isStrategyLoading} />
                </div>


                <div className="mt-4 border-t border-gray-700 pt-3">
                    <div className="space-y-2">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" checked={isTpActive} onChange={(e) => setIsTpActive(e.target.checked)} className="h-4 w-4 bg-gray-700 border-gray-600 rounded text-indigo-600 focus:ring-indigo-500"/>
                            <span className="text-gray-300 font-semibold">Take Profit</span>
                        </label>
                        {isTpActive && (
                             <div className="grid grid-cols-3 gap-2 pl-7">
                                <div>
                                    <label className="block text-gray-400 mb-1 text-xs">Price</label>
                                    <input type="text" value={takeProfitPrice} onChange={(e) => handlePriceChange('tp', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-1.5 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-gray-400 mb-1 text-xs">Pips</label>
                                    <input type="text" value={takeProfitPips} onChange={(e) => handlePipsChange('tp', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-1.5 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-gray-400 mb-1 text-xs">Profit ($)</label>
                                    <input type="text" value={takeProfitAmount} onChange={(e) => handleAmountChange('tp', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-1.5 text-green-400 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>
                        )}
                    </div>
                     <div className="space-y-2 mt-3">
                        <label className="flex items-center space-x-3 cursor-pointer">
                            <input type="checkbox" checked={isSlActive} onChange={(e) => setIsSlActive(e.target.checked)} className="h-4 w-4 bg-gray-700 border-gray-600 rounded text-indigo-600 focus:ring-indigo-500"/>
                            <span className="text-gray-300 font-semibold">Stop Loss</span>
                        </label>
                        {isSlActive && (
                             <div className="grid grid-cols-3 gap-2 pl-7">
                                <div>
                                    <label className="block text-gray-400 mb-1 text-xs">Price</label>
                                    <input type="text" value={stopLossPrice} onChange={(e) => handlePriceChange('sl', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-1.5 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-gray-400 mb-1 text-xs">Pips</label>
                                    <input type="text" value={stopLossPips} onChange={(e) => handlePipsChange('sl', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-1.5 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-gray-400 mb-1 text-xs">Loss ($)</label>
                                    <input type="text" value={stopLossAmount} onChange={(e) => handleAmountChange('sl', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md p-1.5 text-red-400 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>
                        )}
                    </div>
                    <FeedbackDisplay feedback={adjustmentFeedback} isLoading={isFeedbackLoading} />
                </div>
            </div>

            <div className="mt-auto pt-4">
                <button className={`w-full font-bold py-3 rounded-lg text-base transition-colors duration-300 ${isLong ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
                    {isLong ? `Buy ${units} ${config.asset.replace('USDT', '')} MKT` : `Sell ${units} ${config.asset.replace('USDT', '')} MKT`}
                </button>
            </div>
        </div>
    );
};