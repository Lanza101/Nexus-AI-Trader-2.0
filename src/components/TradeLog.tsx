import React from 'react';
import { Trade } from '../types';

interface TradeLogProps {
  trades: Trade[];
}

export const TradeLog: React.FC<TradeLogProps> = ({ trades }) => {
  return (
    <div className="h-64 overflow-y-auto pr-2">
      <ul className="space-y-2">
        {trades.map(trade => (
          <li key={trade.id} className="grid grid-cols-4 items-center text-sm p-1 rounded">
            <span className={`font-bold ${trade.type === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
              {trade.type}
            </span>
            <span className="text-right text-white font-mono">{(trade.size ?? 0).toFixed(4)}</span>
            <span className="text-right text-white font-mono">@${(trade.price ?? 0).toFixed(2)}</span>
            <span className="text-right text-gray-400">{trade.timestamp.toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
