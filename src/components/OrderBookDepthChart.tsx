import React from 'react';
import { OrderBookDataPoint } from '../types';
import { FootprintIcon } from './icons'; // Re-using an icon

interface OrderBookDepthChartProps {
  bids: OrderBookDataPoint[];
  asks: OrderBookDataPoint[];
  isLive: boolean;
}

const ChartPlaceholder: React.FC = () => (
    <div className="flex h-full w-full items-center justify-center text-center p-4 bg-gray-800 rounded-lg">
        <p className="text-gray-500">Awaiting order book data...</p>
    </div>
);


export const OrderBookDepthChart: React.FC<OrderBookDepthChartProps> = ({ bids, asks, isLive }) => {
  if (!bids.length && !asks.length) {
    return <ChartPlaceholder />;
  }

  const sortedBids = [...bids].sort((a, b) => b.price - a.price).slice(0, 15);
  const sortedAsks = [...asks].sort((a, b) => a.price - b.price).slice(0, 15);

  const maxCumulativeSize = Math.max(
    sortedBids.reduce((sum, b) => sum + b.size, 0),
    sortedAsks.reduce((sum, a) => sum + a.size, 0)
  );

  let bidCumulative = 0;
  const bidItems = sortedBids.map(bid => {
    bidCumulative += bid.size;
    return { ...bid, cumulative: bidCumulative };
  });

  let askCumulative = 0;
  const askItems = sortedAsks.map(ask => {
    askCumulative += ask.size;
    return { ...ask, cumulative: askCumulative };
  });

  const priceDecimals = (bids[0]?.price > 100 || asks[0]?.price > 100) ? 2 : 4;

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg h-full flex flex-col">
        <h2 className="text-xl font-semibold mb-2 flex items-center"><FootprintIcon className="mr-2"/>Order Book</h2>
        <div className="grid grid-cols-3 text-center text-xs text-gray-400 font-mono border-b border-gray-700 pb-1 mb-1">
            <span>BID SIZE</span>
            <span>PRICE</span>
            <span>ASK SIZE</span>
        </div>
        <div className="flex-grow overflow-y-auto pr-2 text-xs font-mono relative">
            {/* Asks */}
            <div className="absolute top-0 left-0 right-0">
                 {askItems.reverse().map(({ price, size, cumulative }) => (
                    <div key={`ask-${price}`} className="grid grid-cols-3 items-center h-5 relative text-gray-200">
                        <div className="absolute left-2/3 h-full bg-red-500/10" style={{ width: `${(cumulative / maxCumulativeSize) * 33.3}%`, right: 0 }}></div>
                        <span/>
                        <span className="text-red-400">{price.toFixed(priceDecimals)}</span>
                        <span className="relative z-10 text-right pr-2">{size.toFixed(2)}</span>
                    </div>
                ))}
            </div>
            {/* Bids */}
            <div className="absolute top-0 left-0 right-0" style={{marginTop: `${15*1.25}rem`}}>
                {bidItems.map(({ price, size, cumulative }) => (
                    <div key={`bid-${price}`} className="grid grid-cols-3 items-center h-5 relative text-gray-200">
                        <div className="absolute right-2/3 h-full bg-green-500/10" style={{ width: `${(cumulative / maxCumulativeSize) * 33.3}%`, left: 0 }}></div>
                        <span className="relative z-10 pl-2">{size.toFixed(2)}</span>
                        <span className="text-green-400">{price.toFixed(priceDecimals)}</span>
                        <span/>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};
