
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PriceChartProps {
  data: { time: number; price: number }[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-700 p-2 border border-gray-600 rounded">
          <p className="label text-sm text-white">{`Price : $${payload[0].value.toFixed(2)}`}</p>
          <p className="intro text-xs text-gray-400">{new Date(label).toLocaleTimeString()}</p>
        </div>
      );
    }
  
    return null;
};

export const PriceChart: React.FC<PriceChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="text-center text-gray-500">No data available</div>;
  }

  const lastPrice = data[data.length - 1].price;
  const firstPrice = data[0].price;
  const strokeColor = lastPrice >= firstPrice ? '#4ade80' : '#f87171';
  const fillColor = lastPrice >= firstPrice ? 'url(#colorUv)' : 'url(#colorPv)';


  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{
          top: 10,
          right: 30,
          left: 0,
          bottom: 0,
        }}
      >
        <defs>
          <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
          </linearGradient>
           <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f87171" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis 
            dataKey="time" 
            tickFormatter={(time) => new Date(time).toLocaleTimeString()}
            stroke="#9ca3af"
            fontSize={12}
        />
        <YAxis 
            domain={['dataMin - 100', 'dataMax + 100']} 
            stroke="#9ca3af"
            fontSize={12}
            tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="price" stroke={strokeColor} fill={fillColor} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
};
