import React from 'react';
import { AIAnalysisResult } from '../types';
import { WebhookIcon } from './icons';

interface BreakoutPlansDisplayProps {
    analysis: AIAnalysisResult | null;
}

const renderNeutralSignal = (signal: string) => {
    if (signal.includes('Long breakout:') && signal.includes('Short breakdown:')) {
      const parts = signal.split('Short breakdown:');
      const longPart = parts[0].replace('Long breakout:', '').trim();
      const shortPart = parts[1].trim();
      return (
        <div className="space-y-2 text-sm">
          <div>
            <p className="font-semibold text-green-400">▲ Long Scenario:</p>
            <p className="text-gray-300 pl-4">{longPart}</p>
          </div>
          <div>
            <p className="font-semibold text-red-400">▼ Short Scenario:</p>
            <p className="text-gray-300 pl-4">{shortPart}</p>
          </div>
        </div>
      );
    }
    return <p className="text-gray-200 text-sm">{signal}</p>;
};


export const BreakoutPlansDisplay: React.FC<BreakoutPlansDisplayProps> = ({ analysis }) => {
    if (!analysis || analysis.tradeDirection !== 'NEUTRAL' || !analysis.nextActionableSignal) {
        return null;
    }

    return (
        <div className="bg-gray-800/50 border border-indigo-500/30 p-3 rounded-lg">
            <h3 className="text-sm font-semibold text-indigo-400 flex items-center mb-3 px-1">
                <WebhookIcon className="h-5 w-5 mr-2"/>
                AI-Generated Breakout Plans 
                <span className="text-gray-500 font-normal ml-2">(For Neutral Market Conditions)</span>
            </h3>
            {renderNeutralSignal(analysis.nextActionableSignal)}
        </div>
    );
};
