import React from 'react';
import { MarketData } from '../types';
import { ArrowUpIcon, ArrowDownIcon } from './icons';

interface OrderFlowMetricsProps {
  marketData: MarketData;
}

export const OrderFlowMetrics: React.FC<OrderFlowMetricsProps> = ({ marketData }) => {
    const { cumulativeVolumeDelta, candleHistory } = marketData;
    const lastCandle = candleHistory[candleHistory.length - 1] || { buyVolume: 0, sellVolume: 0, volume: 0 };
    const lastCandleDelta = (lastCandle.buyVolume ?? 0) - (lastCandle.sellVolume ?? 0);

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-3">Order Flow Metrics</h2>
            <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-gray-400">Cumulative Volume Delta</span>
                    <span className={`flex items-center font-bold font-mono ${(cumulativeVolumeDelta ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(cumulativeVolumeDelta ?? 0) >= 0 ? <ArrowUpIcon className="mr-1 h-4 w-4" /> : <ArrowDownIcon className="mr-1 h-4 w-4" />}
                        {(cumulativeVolumeDelta ?? 0).toFixed(0)}
                    </span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-gray-400">Last Candle Delta</span>
                    <span className={`font-bold font-mono ${lastCandleDelta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {lastCandleDelta.toFixed(0)}
                    </span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-gray-400">Last Candle Volume</span>
                    <span className="font-bold font-mono text-white">
                        {(lastCandle.volume ?? 0)?.toLocaleString(undefined, {maximumFractionDigits: 0}) || 0}
                    </span>
                </div>
            </div>
        </div>
    );
};