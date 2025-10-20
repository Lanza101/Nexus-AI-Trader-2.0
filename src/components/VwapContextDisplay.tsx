import React from 'react';
import { Vwap } from '../types';
import { ArrowUpIcon, ArrowDownIcon } from './icons';

interface VwapContextDisplayProps {
    vwap: Vwap;
    price: number;
}

const VwapIndicator: React.FC<{ label: string; vwapValue: number; price: number; }> = ({ label, vwapValue, price }) => {
    if (!vwapValue || vwapValue === 0 || !price || price === 0) {
        return (
            <div className="flex-1 bg-gray-800 p-3 rounded-lg text-center border border-gray-700">
                <div className="text-xs text-gray-500 mb-1">{label}</div>
                <div className="text-lg font-mono text-gray-600">-</div>
            </div>
        );
    }

    const isAbove = price > vwapValue;
    const priceDecimals = vwapValue > 100 ? 2 : 4;
    
    return (
        <div className="flex-1 bg-gray-800 p-3 rounded-lg flex flex-col justify-center items-center border border-gray-700">
            <div className="text-xs text-gray-400 mb-1">{label}</div>
            <div className={`flex items-center space-x-2 ${isAbove ? 'text-green-400' : 'text-red-400'}`}>
                {isAbove ? <ArrowUpIcon className="h-4 w-4" /> : <ArrowDownIcon className="h-4 w-4" />}
                <span className="text-lg font-mono font-bold text-white">{vwapValue.toFixed(priceDecimals)}</span>
            </div>
        </div>
    );
};

export const VwapContextDisplay: React.FC<VwapContextDisplayProps> = ({ vwap, price }) => {
    const hasVwapData = vwap && Object.values(vwap).some((v: number) => v > 0);

    if (!hasVwapData || price <= 0) {
        return null;
    }

    return (
        <div className="bg-gray-800/50 border border-gray-700 p-3 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 px-1">Live VWAP Context <span className="text-gray-500 font-normal">(Price vs Volume-Weighted Average)</span></h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <VwapIndicator label="5-Min" vwapValue={vwap['5m']} price={price} />
                <VwapIndicator label="30-Min" vwapValue={vwap['30m']} price={price} />
                <VwapIndicator label="1-Hour" vwapValue={vwap['1h']} price={price} />
                <VwapIndicator label="24-Hour" vwapValue={vwap['24h']} price={price} />
            </div>
        </div>
    );
};
