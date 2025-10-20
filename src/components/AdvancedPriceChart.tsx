import React, { useMemo } from 'react';
import { Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Cell, Line, ReferenceLine, ReferenceArea, Legend } from 'recharts';
import { Candle, LiquidationLevel, OpenInterestDataPoint, TradingSession } from '../types';
import { ChartIcon } from './icons';

interface AdvancedPriceChartProps {
  priceData: Candle[];
  oiData: OpenInterestDataPoint[];
  liquidationLevels: { longs: LiquidationLevel[], shorts: LiquidationLevel[] };
  session: TradingSession;
  isLive: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-700 p-2 border border-gray-600 rounded text-sm">
          <p className="label text-white">{`Time: ${new Date(label).toLocaleTimeString()}`}</p>
          {data.close && <p className="text-gray-300">{`O: ${data.open?.toFixed(2)} H: ${data.high?.toFixed(2)} L: ${data.low?.toFixed(2)} C: ${data.close?.toFixed(2)}`}</p>}
          {data.volume && <p className={`${data.close >= data.open ? 'text-green-400' : 'text-red-400'}`}>{`Volume: ${data.volume?.toLocaleString()}`}</p>}
          {payload.find(p => p.dataKey === 'value') && <p className="text-purple-400">{`Open Interest: ${payload.find(p=>p.dataKey==='value').value.toLocaleString()}`}</p>}
        </div>
      );
    }
    return null;
};

const ChartPlaceholder: React.FC = () => (
    <div className="flex h-full w-full items-center justify-center relative flex-col text-center p-4 bg-gray-800">
        <div className="flex flex-col items-center justify-center animate-pulse-fast">
            <ChartIcon className="h-16 w-16 text-gray-600 mb-4" />
            <p className="text-lg font-semibold text-gray-500">Connecting to Market Data Stream...</p>
        </div>
    </div>
);

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

const sessionColors: Record<TradingSession, string> = {
    'Asia': '#0f766e', // teal
    'London': '#059669', // green
    'New York': '#4f46e5', // indigo
    'Overlap': '#be185d', // pink
    'Closed': '#374151' // gray
};

export const AdvancedPriceChart: React.FC<AdvancedPriceChartProps> = ({ priceData, oiData, liquidationLevels, session, isLive }) => {
  const { yAxisDomain } = useMemo(() => {
    if (!priceData || priceData.length < 2) {
      return { yAxisDomain: ['auto', 'auto'] };
    }
    
    let minP = Infinity;
    let maxP = -Infinity;
    priceData.forEach(candle => {
      if (candle.low < minP) minP = candle.low;
      if (candle.high > maxP) maxP = candle.high;
    });

    let range = maxP - minP;
    if (range <= 0.00001 || isNaN(range) || !isFinite(minP)) {
        const midPrice = priceData.length > 0 ? priceData[priceData.length - 1].close : 1;
        const offset = midPrice * 0.01; 
        minP = midPrice - offset;
        maxP = midPrice + offset;
        range = maxP - minP;
    }

    const buffer = range * 0.1;
    const finalMinPrice = minP - buffer;
    const finalMaxPrice = maxP + buffer;

    return { yAxisDomain: [finalMinPrice, finalMaxPrice] };
  }, [priceData]);


  if (!priceData || priceData.length === 0) {
    return <ChartPlaceholder />;
  }
  
  const maxVolume = Math.max(...priceData.map(d => d.volume));

  const sessionAreas = [];
  if (priceData.length > 1) {
    let currentSession = getSessionForTimestamp(priceData[0].time);
    let sessionStart = priceData[0].time;

    for(let i = 1; i < priceData.length; i++) {
        const newSession = getSessionForTimestamp(priceData[i].time);
        if(newSession !== currentSession) {
            sessionAreas.push(<ReferenceArea key={`session-${sessionStart}`} x1={sessionStart} x2={priceData[i].time} yAxisId="left" stroke="none" fill={sessionColors[currentSession]} fillOpacity={0.1} />);
            sessionStart = priceData[i].time;
            currentSession = newSession;
        }
    }
    sessionAreas.push(<ReferenceArea key={`session-${sessionStart}`} x1={sessionStart} x2={priceData[priceData.length-1].time} yAxisId="left" stroke="none" fill={sessionColors[currentSession]} fillOpacity={0.1} />);
  }
  
  return (
    <div className="relative w-full h-full flex flex-col">
       <div className="flex-grow">
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={priceData} syncId="syncChart" margin={{ top: 5, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} stroke="#9ca3af" fontSize={10} height={15} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" orientation="left" domain={yAxisDomain} stroke="#9ca3af" fontSize={12} tickFormatter={(value) => `$${Number(value).toFixed(2)}`} width={70} allowDataOverflow={false}/>
                <YAxis yAxisId="right" orientation="right" domain={[0, maxVolume * 3]} hide={true} />
                <Tooltip content={<CustomTooltip />} />
                {sessionAreas}
                {liquidationLevels.shorts.map(l => <ReferenceLine key={`short-${l.price}`} y={l.price} yAxisId="left" stroke="#f87171" strokeDasharray="3 3" strokeWidth={1} label={{ value: `$${(l.amount/1e6).toFixed(0)}M`, position: 'right', fill: '#f87171', fontSize: 10 }} />)}
                {liquidationLevels.longs.map(l => <ReferenceLine key={`long-${l.price}`} y={l.price} yAxisId="left" stroke="#4ade80" strokeDasharray="3 3" strokeWidth={1} label={{ value: `$${(l.amount/1e6).toFixed(0)}M`, position: 'right', fill: '#4ade80', fontSize: 10 }} />)}
                <Area yAxisId="left" type="monotone" dataKey="close" stroke="#8884d8" fill="#8884d8" fillOpacity={0.2} strokeWidth={2} name="Price"/>
                <Bar yAxisId="right" dataKey="volume" fill="#4a5568" name="Volume">
                    { priceData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.close >= entry.open ? 'rgba(74, 222, 128, 0.5)' : 'rgba(248, 113, 113, 0.5)'} />) }
                </Bar>
            </ComposedChart>
        </ResponsiveContainer>
       </div>
       <div className="h-1/4 pt-2">
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={oiData} syncId="syncChart" margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" tick={false} axisLine={false} />
                <YAxis domain={['dataMin * 0.99', 'dataMax * 1.01']} stroke="#9ca3af" fontSize={10} tickFormatter={(value) => `${(Number(value)/1000).toFixed(0)}k`} width={70} />
                <Tooltip content={<CustomTooltip />} />
                <Legend verticalAlign="top" height={20} iconSize={10} wrapperStyle={{fontSize: "12px", top: "-5px"}}/>
                <Area type="monotone" dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.2} strokeWidth={2} name="Open Interest"/>
            </ComposedChart>
        </ResponsiveContainer>
       </div>
    </div>
  );
};
