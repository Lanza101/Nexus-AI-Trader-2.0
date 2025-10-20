
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Candle } from '../types';

interface CandlestickVolumeProfileChartProps {
  data: Candle[];
}

interface ProfileData extends Candle {
  valueArea: { high: number, low: number };
  pocPrice: number;
  maxVolumeInBar: number;
}

const AXIS_WIDTH = 50;
const AXIS_HEIGHT = 30;

export const CandlestickVolumeProfileChart: React.FC<CandlestickVolumeProfileChartProps> = ({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width, height });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => { if (containerRef.current) observer.unobserve(containerRef.current) };
  }, []);
  
  const recentCandles = useMemo(() => data.slice(-40), [data]);
  
  const { candlesWithProfiles, minPrice, maxPrice, priceRange } = useMemo(() => {
    if (!recentCandles || recentCandles.length < 2) {
      return { candlesWithProfiles: [], minPrice: 0, maxPrice: 0, priceRange: 0 };
    }

    let minP = Infinity;
    let maxP = -Infinity;
    recentCandles.forEach(candle => {
      if (candle.low < minP) minP = candle.low;
      if (candle.high > maxP) maxP = candle.high;
    });

    let range = maxP - minP;

    if (range <= 0.00001 || isNaN(range) || !isFinite(minP)) {
        const midPrice = recentCandles.length > 0 ? recentCandles[recentCandles.length - 1].close : 1;
        const offset = midPrice * 0.01;
        minP = midPrice - offset;
        maxP = midPrice + offset;
        range = maxP - minP;
    }

    const buffer = range * 0.1;
    const finalMinPrice = minP - buffer;
    const finalMaxPrice = maxP + buffer;
    const finalPriceRange = finalMaxPrice - finalMinPrice;
    
    // --- Profile Calculation ---
    const candlesWithProfiles: ProfileData[] = recentCandles.map(candle => {
      if (!candle.footprint || candle.footprint.length === 0) {
        return { ...candle, valueArea: { high: candle.high, low: candle.low }, pocPrice: candle.close, maxVolumeInBar: 1 };
      }

      const totalVolume = candle.footprint.reduce((sum, fp) => sum + fp.buyVolume + fp.sellVolume, 0);
      const targetVolume = totalVolume * 0.7;

      const poc = candle.footprint.reduce((acc, curr) => 
          (curr.buyVolume + curr.sellVolume) > (acc.buyVolume + acc.sellVolume) ? curr : acc
      );

      let valueAreaVolume = poc.buyVolume + poc.sellVolume;
      let valueAreaHigh = poc.price;
      let valueAreaLow = poc.price;

      const sortedByPrice = [...candle.footprint].sort((a,b) => b.price - a.price);
      const pocIndex = sortedByPrice.findIndex(fp => fp.price === poc.price);
      
      let aboveIndex = pocIndex - 1;
      let belowIndex = pocIndex + 1;

      while(valueAreaVolume < targetVolume && (aboveIndex >= 0 || belowIndex < sortedByPrice.length)) {
        const aboveVol = aboveIndex >= 0 ? sortedByPrice[aboveIndex].buyVolume + sortedByPrice[aboveIndex].sellVolume : -1;
        const belowVol = belowIndex < sortedByPrice.length ? sortedByPrice[belowIndex].buyVolume + sortedByPrice[belowIndex].sellVolume : -1;
        
        if (aboveVol > belowVol) {
          valueAreaVolume += aboveVol;
          valueAreaHigh = sortedByPrice[aboveIndex].price;
          aboveIndex--;
        } else if (belowVol > -1) {
          valueAreaVolume += belowVol;
          valueAreaLow = sortedByPrice[belowIndex].price;
          belowIndex++;
        } else {
            break;
        }
      }

      const maxVolumeInBar = Math.max(...candle.footprint.map(fp => fp.buyVolume + fp.sellVolume), 0);
      
      return { ...candle, valueArea: { high: valueAreaHigh, low: valueAreaLow }, pocPrice: poc.price, maxVolumeInBar: maxVolumeInBar > 0 ? maxVolumeInBar : 1 };
    });

    return { candlesWithProfiles, minPrice: finalMinPrice, maxPrice: finalMaxPrice, priceRange: finalPriceRange };
    
  }, [recentCandles]);

  const priceToY = (price: number) => {
    if (priceRange <= 0) return (dimensions.height - AXIS_HEIGHT) / 2;
    return (dimensions.height - AXIS_HEIGHT) - ((price - minPrice) / priceRange) * (dimensions.height - AXIS_HEIGHT);
  };

  const candleWidth = Math.max(5, (dimensions.width - AXIS_WIDTH) / recentCandles.length * 0.7);
  const candleSpacing = (dimensions.width - AXIS_WIDTH) / recentCandles.length;

  return (
    <div ref={containerRef} className="bg-gray-800 p-4 rounded-lg shadow-lg h-full flex flex-col">
      <h2 className="text-lg font-semibold text-white mb-2 -mt-2 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          Candlestick Volume Profile
      </h2>
      <div className="flex-grow min-h-0 relative">
        {dimensions.width > 0 && priceRange > 0 && (
          <svg width={dimensions.width} height={dimensions.height} className="overflow-visible">
            {/* Y-Axis (Price) */}
            <g className="y-axis">
              {Array.from({ length: 7 }).map((_, i) => {
                const price = minPrice + (priceRange / 6) * i;
                const y = priceToY(price);
                return (
                  <g key={i}>
                    <line x1={AXIS_WIDTH - 5} y1={y} x2={dimensions.width} y2={y} stroke="#374151" strokeDasharray="2,2" />
                    <text x={AXIS_WIDTH - 8} y={y + 4} fill="#9ca3af" textAnchor="end" fontSize="10">{price.toFixed(2)}</text>
                  </g>
                );
              })}
            </g>

            {/* X-Axis (Time) */}
            <g className="x-axis">
              {candlesWithProfiles.map((candle, index) => {
                if (index % 5 !== 0) return null;
                const x = AXIS_WIDTH + index * candleSpacing + candleSpacing / 2;
                return (
                  <text key={candle.time} x={x} y={dimensions.height - AXIS_HEIGHT + 15} fill="#9ca3af" textAnchor="middle" fontSize="10">
                    {new Date(candle.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </text>
                );
              })}
            </g>

            {/* Chart Content */}
            <g transform={`translate(${AXIS_WIDTH}, 0)`}>
              {candlesWithProfiles.map((candle, index) => {
                const x = index * candleSpacing;
                const isUp = candle.close >= candle.open;
                const color = isUp ? '#10B981' : '#EF4444';

                // Candlestick
                const yOpen = priceToY(candle.open);
                const yClose = priceToY(candle.close);
                const yHigh = priceToY(candle.high);
                const yLow = priceToY(candle.low);
                const bodyY = Math.min(yOpen, yClose);
                const bodyHeight = Math.max(1, Math.abs(yOpen - yClose));
                
                // Volume Profile
                const profileX = x + candleWidth + 2;
                const profileWidth = candleSpacing - candleWidth - 4;

                return (
                  <g key={candle.time}>
                    {/* Volume Profile Bars */}
                    {candle.footprint?.map(fp => {
                      const volume = fp.buyVolume + fp.sellVolume;
                      const barWidth = (volume / candle.maxVolumeInBar) * profileWidth;
                      const y = priceToY(fp.price);
                      const isPoc = fp.price === candle.pocPrice;
                      const isValueArea = fp.price >= candle.valueArea.low && fp.price <= candle.valueArea.high;

                      return (
                        <rect
                          key={fp.price}
                          x={profileX}
                          y={y}
                          width={barWidth}
                          height={1}
                          fill={isPoc ? '#FBBF24' : isValueArea ? '#60A5FA' : '#4B5563'}
                          opacity={0.7}
                        />
                      );
                    })}

                    {/* Candlestick Wick */}
                    <line x1={x + candleWidth / 2} y1={yHigh} x2={x + candleWidth / 2} y2={yLow} stroke={color} strokeWidth="1" />
                    {/* Candlestick Body */}
                    <rect x={x} y={bodyY} width={candleWidth} height={bodyHeight} fill={color} />
                  </g>
                )
              })}
            </g>
          </svg>
        )}
        {(!candlesWithProfiles || candlesWithProfiles.length === 0) && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500">
            Awaiting historical data...
          </div>
        )}
      </div>
    </div>
  );
};