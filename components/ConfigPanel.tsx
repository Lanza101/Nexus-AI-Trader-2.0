import React from 'react';
import { BotConfig } from '../types';

interface ConfigPanelProps {
  config: BotConfig;
  setConfig: React.Dispatch<React.SetStateAction<BotConfig>>;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, setConfig }) => {
  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setConfig(prevConfig => ({
      ...prevConfig,
      [name]: name === 'asset' ? value : Number(value),
    }));
  };

  return (
    <div className="space-y-6 text-sm">
      <div>
        <label htmlFor="asset" className="block text-gray-400 mb-1">Trading Pair</label>
        <select
          id="asset"
          name="asset"
          value={config.asset}
          onChange={handleConfigChange}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <optgroup label="Crypto">
            <option value="BTCUSDT">BTC/USDT</option>
            <option value="ETHUSDT">ETH/USDT</option>
            <option value="SOLUSDT">SOL/USDT</option>
          </optgroup>
          <optgroup label="Forex Majors">
            <option value="EURUSD">EUR/USD</option>
            <option value="GBPUSD">GBP/USD</option>
            <option value="USDJPY">USD/JPY</option>
          </optgroup>
           <optgroup label="Metals">
            <option value="XAUUSD">XAU/USD (Gold)</option>
            <option value="XAGUSD">XAG/USD (Silver)</option>
          </optgroup>
        </select>
      </div>

      <div>
        <label htmlFor="accountBalance" className="block text-gray-400 mb-1">Account Balance ($)</label>
        <input
          type="number"
          id="accountBalance"
          name="accountBalance"
          value={config.accountBalance}
          onChange={handleConfigChange}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g., 10000"
          step="100"
        />
      </div>

      <div>
        <label htmlFor="leverage" className="block text-gray-400 mb-1">Leverage: <span className="font-bold text-indigo-400">{config.leverage}x</span></label>
        <input
          type="range"
          id="leverage"
          name="leverage"
          min="1"
          max="100"
          step="1"
          value={config.leverage}
          onChange={handleConfigChange}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      <div>
        <label htmlFor="riskPercentage" className="block text-gray-400 mb-1">Max Risk per Trade: <span className="font-bold text-indigo-400">{Number(config.riskPercentage).toFixed(1)}%</span></label>
        <input
          type="range"
          id="riskPercentage"
          name="riskPercentage"
          min="0.2"
          max="5"
          step="0.1"
          value={config.riskPercentage}
          onChange={handleConfigChange}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      <div className="pt-4 border-t border-gray-700">
        <h3 className="text-lg font-semibold text-white">Strategy: Scalping</h3>
        <p className="text-gray-400 mt-1">
          This bot analyzes live market data using a high-frequency scalping strategy, aiming for small, quick profits by exploiting minor price fluctuations.
        </p>
      </div>
    </div>
  );
};