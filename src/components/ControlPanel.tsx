

import React, { useState, useEffect } from 'react';
import { BotConfig, MarketData, Trade, TradeSignal } from '../types';
import { ConfigPanel } from './ConfigPanel';
import { TradingViewIcon, WebhookIcon, CopyIcon, ConfigIcon, ListIcon } from './icons';
import { OrderBookDepthChart } from './OrderBookDepthChart';
import { TradeLog } from './TradeLog';

interface ControlPanelProps {
  config: BotConfig;
  setConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
  latestSignal: TradeSignal | null;
  trades: Trade[];
  marketData: MarketData;
  connectionStatus: string;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ config, setConfig, latestSignal, trades, marketData, connectionStatus }) => {
  const [copyButtonText, setCopyButtonText] = useState('Copy Signal');

  useEffect(() => {
    if (copyButtonText === 'Copied!') {
      const timer = setTimeout(() => setCopyButtonText('Copy Signal'), 2000);
      return () => clearTimeout(timer);
    }
  }, [copyButtonText]);

  const handleCopy = () => {
    if (latestSignal) {
      const signalText = JSON.stringify(latestSignal, null, 2);
      navigator.clipboard.writeText(signalText);
      setCopyButtonText('Copied!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4 flex items-center"><ConfigIcon className="mr-2"/>Bot Configuration</h2>
        <ConfigPanel config={config} setConfig={setConfig} />
      </div>

      <div className="bg-gray-800 rounded-lg shadow-lg h-[400px]">
        <OrderBookDepthChart 
            bids={marketData.orderBook.bids} 
            asks={marketData.orderBook.asks} 
            isLive={connectionStatus === 'connected'} 
        />
      </div>
      
      <div className="bg-gray-800 p-4 rounded-lg shadow-lg h-[400px] flex flex-col">
        <h2 className="text-xl font-semibold mb-2 flex items-center"><ListIcon className="mr-2"/>Live Trades</h2>
        <div className="flex-grow overflow-hidden">
            <TradeLog trades={trades} />
        </div>
      </div>

      <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-2 flex items-center"><WebhookIcon className="mr-2 h-5 w-5"/>Automated Trade Signal</h2>
        <p className="text-sm text-gray-400 mb-4">
          This panel shows the JSON data packet the Gemini AI generates. In a real automated system, this signal would be sent to a trading bot or exchange to execute the trade instantly.
        </p>
        
        <div className="bg-gray-900 rounded-md p-3 relative">
          <button 
            onClick={handleCopy}
            className="absolute top-2 right-2 bg-gray-700 hover:bg-indigo-500 text-white p-1.5 rounded-md text-xs flex items-center transition-colors"
            aria-label="Copy trade signal JSON"
          >
            <CopyIcon className="h-4 w-4 mr-1" />
            {copyButtonText}
          </button>
          <pre className="text-xs text-yellow-300 whitespace-pre-wrap overflow-x-auto font-mono">
            {latestSignal ? JSON.stringify(latestSignal, null, 2) : 'Awaiting trade signal...'}
          </pre>
        </div>

        <div className="mt-4 text-xs text-gray-500 space-y-2">
            <p><strong>How Automation Works:</strong></p>
            <ol className="list-decimal list-inside space-y-1">
                <li>The AI engine analyzes the live market data from Binance.</li>
                <li>It generates a precise trade signal in the structured JSON format shown above.</li>
                <li>An automated bot would receive this JSON and execute the trade with the exact parameters (entry, stop loss, etc.).</li>
            </ol>
        </div>
      </div>
    </div>
  );
};
