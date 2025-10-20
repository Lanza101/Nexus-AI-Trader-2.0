import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area } from 'recharts';
import { Candle, TradingSession } from '../types';
import { ChartIcon } from './icons';

interface AnchoredVwapChartProps {
  data: Candle[];
}

const getSessionForTimestamp = (time: number): TradingSession => {
    const date = new Date(time);
    const hourUTC = date.getUTCHours();
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

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-700 p-2 border border-gray-600 rounded text-sm">
          <p className="label text-white">{`Time: ${new Date(label).toLocaleTimeString()}`}</p>
          <p className="text-gray-300">{`O: ${data.open?.toFixed(2)} H: ${data.high?.toFixed(2)} L: ${data.low?.toFixed(2)} C: ${data.close?.toFixed(2)}`}</p>
          {data.avwap !== null && data.avwap !== undefined && <p className="text-yellow-400">{`AVWAP: $${data.avwap.toFixed(2)}`}</p>}
        </div>
      );
    }
    return null;
};

const CandlestickShape = (props: any) => {
    const { x, width, yAxis, payload } = props;
    if (!payload || !yAxis) return null;
    const { open, close, high, low } = payload;

    const isUp = close >= open;
    const color = isUp ? '#4ade80' : '#f87171';

    // y-coordinates from price values
    const yHigh = yAxis.scale(high);
    const yLow = yAxis.scale(low);
    const yOpen = yAxis.scale(open);
    const yClose = yAxis.scale(close);
    
    const bodyHeight = Math.abs(yOpen - yClose);
    const finalBodyHeight = bodyHeight === 0 ? 1 : bodyHeight;
    const bodyY = Math.min(yOpen, yClose);
    const wickX = x + width / 2;
  
    return (
      <g strokeWidth={1.5} stroke={color}>
        {/* Wick */}
        <line x1={wickX} y1={yHigh} x2={wickX} y2={yLow} />
        {/* Body */}
        <rect x={x} y={bodyY} width={width} height={finalBodyHeight} fill={color} />
      </g>
    );
};

export const AnchoredVwapChart: React.FC<AnchoredVwapChartProps> = ({ data }) => {
  const [anchorTime, setAnchorTime] = useState<number | null>(null);
  const [anchorLabel, setAnchorLabel] = useState<string>('');
  
  const handleSetAnchor = useCallback((type: 'session' | 'high' | 'low') => {
      if (data.length === 0) return;
      
      let anchorCandle: Candle | undefined;
      let label = '';

      if (type === 'session') {
          const currentSession = getSessionForTimestamp(data[data.length-1].time);
          anchorCandle = data.find(c => getSessionForTimestamp(c.time) === currentSession);
          label = `${currentSession} Session Start`;
      } else if (type === 'high') {
          anchorCandle = data.reduce((max, c) => c.high > max.high ? c : max, data[0]);
          label = '24h High';
      } else { // low
          anchorCandle = data.reduce((min, c) => c.low < min.low ? c : min, data[0]);
          label = '24h Low';
      }

      if (anchorCandle) {
          setAnchorTime(anchorCandle.time);
          setAnchorLabel(label);
      }
  }, [data]);

  // Auto-anchor to session start on initial load
  useEffect(() => {
    if (data.length > 0 && !anchorTime) {
      handleSetAnchor('session');
    }
  }, [data, anchorTime, handleSetAnchor]);

  // Intelligent Re-anchoring: If the anchor scrolls out of view, reset it.
  useEffect(() => {
    if (anchorTime && data.length > 0) {
      const isAnchorPresent = data.some(c => c.time >= anchorTime);
      if (!isAnchorPresent) {
        // Anchor has scrolled off. Reset to the current session start.
        handleSetAnchor('session');
      }
    }
  }, [data, anchorTime, handleSetAnchor]);

  const { chartData, yAxisDomain } = useMemo(() => {
    if (data.length < 2) {
      return { chartData: data.map(c => ({...c, avwap: null, upperBand: null, lowerBand: null})), yAxisDomain: ['auto', 'auto'] };
    }

    let minP = Infinity;
    let maxP = -Infinity;
    data.forEach(candle => {
      if (candle.low < minP) minP = candle.low;
      if (candle.high > maxP) maxP = candle.high;
    });

    let range = maxP - minP;
    if (range <= 0.00001 || isNaN(range) || !isFinite(minP)) {
        const midPrice = data.length > 0 ? data[data.length - 1].close : 1;
        const offset = midPrice * 0.01;
        minP = midPrice - offset;
        maxP = midPrice + offset;
        range = maxP - minP;
    }

    const buffer = range * 0.1;
    const finalMinPrice = minP - buffer;
    const finalMaxPrice = maxP + buffer;
    const domain = [finalMinPrice, finalMaxPrice];
    
    // --- AVWAP Calculation ---
    if (!anchorTime) {
      return { chartData: data.map(c => ({...c, avwap: null, upperBand: null, lowerBand: null})), yAxisDomain: domain };
    }
    const anchorIndex = data.findIndex(c => c.time >= anchorTime);
    if (anchorIndex === -1) {
        return { chartData: data.map(c => ({...c, avwap: null, upperBand: null, lowerBand: null})), yAxisDomain: domain };
    }
    let cumulativePV = 0;
    let cumulativeVolume = 0;
    let cumulativeVar = 0;
    const avwapData = data.map((candle, index) => {
        if (index < anchorIndex) {
            return { ...candle, avwap: null, upperBand: null, lowerBand: null };
        }
        const typicalPrice = (candle.high + candle.low + candle.close) / 3;
        cumulativePV += typicalPrice * candle.volume;
        cumulativeVolume += candle.volume;
        const avwap = cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : 0;
        cumulativeVar += Math.pow(typicalPrice - avwap, 2) * candle.volume;
        const variance = cumulativeVolume > 0 ? cumulativeVar / cumulativeVolume : 0;
        const stdev = Math.sqrt(variance);
        return { ...candle, avwap, upperBand: avwap + stdev, lowerBand: avwap - stdev };
    });
    return { chartData: avwapData, yAxisDomain: domain };
  }, [data, anchorTime]);


  if (data.length < 10) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <ChartIcon className="h-12 w-12 text-gray-600 mb-4" />
            <p className="text-lg font-semibold text-gray-500">Insufficient data for VWAP calculation.</p>
        </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-2 -mt-2">
         <h2 className="text-lg font-semibold text-white">Anchored VWAP Analysis</h2>
         <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-400">Anchor to:</span>
            <button onClick={() => handleSetAnchor('session')} className="text-xs bg-gray-700 hover:bg-indigo-600 px-2 py-1 rounded">Session Start</button>
            <button onClick={() => handleSetAnchor('high')} className="text-xs bg-gray-700 hover:bg-indigo-600 px-2 py-1 rounded">24h High</button>
            <button onClick={() => handleSetAnchor('low')} className="text-xs bg-gray-700 hover:bg-indigo-600 px-2 py-1 rounded">24h Low</button>
         </div>
      </div>
      <div className="flex-grow min-h-0">
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="#9ca3af" fontSize={10} height={20} tickLine={false} />
                <YAxis yAxisId="left" orientation="left" domain={yAxisDomain} stroke="#9ca3af" fontSize={12} tickFormatter={(value) => `$${Number(value).toFixed(2)}`} width={70} allowDataOverflow={false}/>
                <Tooltip content={<CustomTooltip />} />
                
                <Area yAxisId="left" type="monotone" dataKey={(d: any) => d.upperBand && d.lowerBand ? [d.lowerBand, d.upperBand] : null} fill="#4338ca" stroke="none" fillOpacity={0.2} name="VWAP Bands" />
                
                <Line yAxisId="left" type="monotone" dataKey="avwap" stroke="#a5b4fc" strokeWidth={2} dot={false} name="AVWAP" />
                
                <Bar yAxisId="left" dataKey="close" shape={<CandlestickShape />} />

                {anchorTime && (
                    <ReferenceLine 
                        yAxisId="left"
                        x={anchorTime} 
                        stroke="#a5b4fc" 
                        strokeDasharray="4 4" 
                        strokeWidth={1.5} 
                        label={{ value: `Anchor: ${anchorLabel}`, position: 'insideTopLeft', fill: '#a5b4fc', fontSize: 10, dy: 10, dx: 10 }}
                    />
                )}
            </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
};
