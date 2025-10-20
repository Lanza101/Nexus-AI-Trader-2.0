import React from 'react';
import { ArrowDownIcon, ArrowUpIcon } from './icons';

interface MetricCardProps {
  title: React.ReactNode;
  value: string;
  change?: number;
  changeType?: 'value' | 'percent';
}

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, change, changeType }) => {
  const isPositive = change !== undefined && change >= 0;

  const formatChange = () => {
    if (change === undefined) return null;
    if (changeType === 'percent') {
      return `${change.toFixed(2)}%`;
    }
    if (typeof title === 'string' && title === "CVD") {
      return Math.abs(change).toFixed(0);
    }
    return `$${Math.abs(change).toFixed(2)}`;
  };
  
  return (
    <div className="relative bg-gray-800 p-4 rounded-lg shadow-md border border-gray-700 hover:border-indigo-500 hover:scale-105 hover:z-10 transition-all duration-200 cursor-pointer h-full flex flex-col justify-between">
      <div className="text-sm text-gray-400 mb-1">{title}</div>
      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-bold text-white">{value}</p>
        {change !== undefined && typeof change === 'number' && !isNaN(change) && (
          <span className={`flex items-center text-sm font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? <ArrowUpIcon /> : <ArrowDownIcon />}
            {formatChange()}
          </span>
        )}
      </div>
    </div>
  );
};
