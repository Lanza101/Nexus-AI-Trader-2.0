
import { GoogleGenAI, Type } from "@google/genai";
import { MarketData, BotConfig, AIAnalysisResult, AdjustmentFeedback, OptimizedTradePlan, FootprintDataPoint, TradeDebriefResult } from '../types';

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    tradeDirection: { type: Type.STRING, enum: ['LONG', 'SHORT', 'NEUTRAL'], description: 'A clear "LONG", "SHORT", or "NEUTRAL" bias.' },
    speculativeDirection: { type: Type.STRING, enum: ['LONG', 'SHORT'], description: 'If tradeDirection is NEUTRAL, this is mandatory. It indicates the direction of the speculative trade idea.' },
    keyObservation: { type: Type.STRING, description: 'A specific, one-sentence insight that justifies the bias based on confluence. If neutral, explain why and also the reasoning for the speculative bias.' },
    entryPrice: { type: Type.NUMBER, description: 'Suggested entry price. For NEUTRAL signals, this is for the speculative trade idea.' },
    stopLoss: { type: Type.NUMBER, description: 'Suggested stop-loss price. For NEUTRAL signals, this is for the speculative trade idea.' },
    takeProfit: { type: Type.NUMBER, description: 'Suggested take-profit price. For NEUTRAL signals, this is for the speculative trade idea.' },
    positionSize: { type: Type.NUMBER, description: 'Calculated position size. For NEUTRAL signals, this is for the speculative trade idea.' },
    confidence: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
    nextActionableSignal: { type: Type.STRING, description: 'For NEUTRAL signals, this MUST contain two high-probability breakout plans. For LONG/SHORT, this can be a brief confirmation.' },
    stopLossJustification: { type: Type.STRING, description: 'A clear, one-sentence technical reason for the chosen Stop Loss price.' },
    takeProfitJustification: { type: Type.STRING, description: 'A clear, one-sentence technical reason for the chosen Take Profit price.' },
  },
  required: ['tradeDirection', 'keyObservation', 'entryPrice', 'stopLoss', 'takeProfit', 'positionSize', 'confidence', 'nextActionableSignal', 'stopLossJustification', 'takeProfitJustification'],
};

const getPocFromFootprint = (footprint: FootprintDataPoint[] | undefined): number | null => {
    if (!footprint || footprint.length === 0) return null;
    const poc = footprint.reduce((acc, curr) => {
        const totalVolume = curr.buyVolume + curr.sellVolume;
        if (!acc || totalVolume > (acc.buyVolume + acc.sellVolume)) {
            return curr;
        }
        return acc;
    });
    return poc.price;
}

export const getMarketAnalysis = async (marketData: MarketData, config: BotConfig): Promise<AIAnalysisResult | string> => {
  if (!process.env.API_KEY) {
    return "Error: API_KEY is not configured. Please set it up in your deployment environment.";
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const { price, candleHistory, cumulativeVolumeDelta, vwap, emas, tradingSession, openInterest, orderBook, liquidationLevels } = marketData;
  
  const recentCandles = candleHistory.slice(-5);
  const historicalCandles = candleHistory.slice(-100);

  const sessionHigh = historicalCandles.length > 0 ? Math.max(...historicalCandles.map(c => c.high)) : price;
  const sessionLow = historicalCandles.length > 0 ? Math.min(...historicalCandles.map(c => c.low)) : price;
  
  const recentCandlesSummary = recentCandles.map(c => 
    `{O: ${c.open.toFixed(2)}, H: ${c.high.toFixed(2)}, L: ${c.low.toFixed(2)}, C: ${c.close.toFixed(2)}, V: ${c.volume.toFixed(2)}, Delta: ${(c.buyVolume - c.sellVolume).toFixed(2)}}`
  ).join(', ');
  
  const averageRange = recentCandles.length > 0 ? recentCandles.reduce((sum, c) => sum + (c.high - c.low), 0) / recentCandles.length : 0;
  const priceDecimals = price > 100 ? 2 : 4;

  const recentPocs = recentCandles.map((c, i) => {
      const poc = getPocFromFootprint(c.footprint);
      return poc ? `Candle T-${4-i} POC: $${poc.toFixed(priceDecimals)}` : null;
  }).filter(Boolean).join(', ');

  const prompt = `
    You are an expert institutional-grade technical analyst AI. Your analysis MUST now incorporate deep order flow, candlestick volume profiles, and session context for a CFD scalping strategy on ${config.asset}.

    Trader's Configuration:
    - Account Balance: $${config.accountBalance}
    - Leverage: ${config.leverage}x
    - Max Risk per trade: ${config.riskPercentage}% ($${(config.accountBalance * (config.riskPercentage / 100)).toFixed(2)})

    Core Market Data:
    - Current Price: $${price.toFixed(priceDecimals)}
    - Cumulative Volume Delta (Session): ${cumulativeVolumeDelta.toFixed(2)}
    - Average Candle Range (Volatility): $${averageRange.toFixed(priceDecimals)}
    - Most Recent Candles (OHLCV, Delta): ${recentCandlesSummary}

    Advanced Order Flow & Session Data:
    - Current Trading Session: ${tradingSession}
    - Open Interest: ${openInterest.toLocaleString()}
    - Top 5 Bids (Buy Orders): ${orderBook.bids.slice(0, 5).map(b => `$${b.price.toFixed(priceDecimals)} (${b.size.toFixed(2)})`).join(', ')}
    - Top 5 Asks (Sell Orders): ${orderBook.asks.slice(0, 5).map(a => `$${a.price.toFixed(priceDecimals)} (${a.size.toFixed(2)})`).join(', ')}
    - Major Short Liquidation Levels: ${liquidationLevels.shorts.slice(0, 3).map(l => `$${l.price.toFixed(priceDecimals)} ($${(l.amount/1e6).toFixed(1)}M)`).join(', ')}
    - Major Long Liquidation Levels: ${liquidationLevels.longs.slice(0, 3).map(l => `$${l.price.toFixed(priceDecimals)} ($${(l.amount/1e6).toFixed(1)}M)`).join(', ')}

    Key Technical Levels:
    - Session High (Liquidity Zone): $${sessionHigh.toFixed(priceDecimals)}
    - Session Low (Liquidity Zone): $${sessionLow.toFixed(priceDecimals)}
    - 5-min VWAP: $${(vwap['5m'] ?? 0).toFixed(priceDecimals)}
    - 1-hour VWAP: $${(vwap['1h'] ?? 0).toFixed(priceDecimals)}
    - 21 EMA (Trend): $${(emas['21'] ?? 0).toFixed(priceDecimals)}
    - 50 EMA (Baseline): $${(emas['50'] ?? 0).toFixed(priceDecimals)}

    Recent Candlestick Volume Profile Analysis:
    - Recent Candle Points of Control (POCs): ${recentPocs || 'N/A'}. These are micro support/resistance levels where the most volume was traded.

    Your Analytical Process (NEW, FOLLOW PRECISELY):
    1.  **Session Context First**: Identify the current session (${tradingSession}). During 'Asia', favor range-bound strategies unless strong momentum is present. During 'London', 'New York', or 'Overlap', expect higher volatility and prioritize breakout/trend-following strategies.
    2.  **Order Flow & Liquidity Analysis**: This is your primary driver.
        - Are there large walls on the order book (bids/asks)? A large bid wall below price is strong support. A large ask wall above is strong resistance.
        - Identify the NEAREST major liquidation level. This is a primary magnet for price. It should be your default Take Profit target unless contradicted by other factors.
        - Check Open Interest. Is it rising with price (confirming trend) or diverging (suggesting weakness)?
    3.  **Price Action Confluence**: Combine order flow insights with price action.
        - Is there a liquidity grab (stop hunt) occurring *into* a large order book wall or towards a liquidation level? This is an A+ setup.
        - How is price reacting to EMAs/VWAP in the context of the order flow? A bounce from the 21 EMA that is also supported by a large bid wall is a very strong signal.
        - **Volume Profile Context**: How is price reacting to the 'Recent Candle POCs'? A rejection from a previous candle's POC adds strong confirmation to a reversal trade. A breakout past a recent POC cluster confirms momentum.
    4.  **Formulate Trade Plan**:
        - **Key Observation**: MUST begin by stating the session context and the primary order flow observation. Incorporate the volume profile context. Example: "In the London session, price is being supported by a large bid wall at $PRICE and has just reclaimed the previous candle's POC, creating a potential long opportunity towards the short liquidation cluster at $PRICE."
        - **Take Profit Justification**: MUST reference the specific liquidation level or order book wall it's targeting.
        - **stopLossJustification**: Provide a concise, technical reason for the SL price. Reference the structure it's behind (e.g., session low, VWAP, order book wall, recent POC) AND its relationship to the 'Average Candle Range' for volatility protection.
        - **Position Sizing**: The "positionSize" MUST be calculated to risk exactly the "Max Risk per trade" amount based on your stop loss distance. Formula: Position Size = (Risk Amount) / (Distance between Entry and Stop-Loss).
    5.  **Handle Neutral Markets**: If there is no clear edge from order flow or price action (e.g., heavy CONSOLIDATION in 'Asia' session with no large order book walls), declare "NEUTRAL". Provide a low-confidence speculative trade idea and MANDATORILY provide two distinct breakout plans in the "nextActionableSignal" field, formatted exactly like this: "Long breakout: Enter at $PRICE, SL at $PRICE, TP at $PRICE. Short breakdown: Enter at $PRICE, SL at $PRICE, TP at $PRICE."

    Now, generate the JSON object adhering to the schema and all instructions.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      }
    });
    
    const text = response.text.trim();
    const analysisResult: AIAnalysisResult = JSON.parse(text);
    return analysisResult;
  } catch (error: any) {
    console.error("Error processing Gemini analysis:", error);
    
    let errorString = '';
    try { errorString = JSON.stringify(error); } catch (e) { /* ignore */ }
    if (error?.message) { errorString += ' ' + error.message; }

    if (errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('429')) {
      return "RATE_LIMIT_EXCEEDED";
    }
    
    if (error instanceof SyntaxError) {
      return "Error: Failed to parse AI response. The data format was invalid.";
    }
    
    return "Error: Could not retrieve AI analysis. The API key might be invalid or the service may be temporarily unavailable.";
  }
};


const adjustmentFeedbackSchema = {
  type: Type.OBJECT,
  properties: {
    feedback: { type: Type.STRING, description: 'Concise, actionable feedback on the user\'s SL/TP adjustment. Start with "Warning:" for poor adjustments.' },
  },
  required: ['feedback'],
};

export const getTradeAdjustmentAnalysis = async (
  originalAnalysis: AIAnalysisResult,
  newStopLoss: number,
  newTakeProfit: number,
  marketData: MarketData
): Promise<AdjustmentFeedback | string> => {
  if (!process.env.API_KEY) {
    return "Error: API_KEY is not configured.";
  }
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const { price, support, resistance, vwap, emas } = marketData;
  const priceDecimals = price > 100 ? 2 : 4;

  const prompt = `
    You are a trading mentor AI. A trader has received an initial analysis and has manually adjusted the Stop Loss and/or Take Profit. Your task is to provide concise, expert feedback on their changes.

    Original AI Trade Idea:
    - Direction: ${originalAnalysis.tradeDirection}
    - Key Observation: ${originalAnalysis.keyObservation}
    - Original Entry: $${originalAnalysis.entryPrice.toFixed(priceDecimals)}
    - Original Stop Loss: $${originalAnalysis.stopLoss.toFixed(priceDecimals)}
    - Original Take Profit: $${originalAnalysis.takeProfit.toFixed(priceDecimals)}

    Trader's Manual Adjustment:
    - New Stop Loss: $${newStopLoss.toFixed(priceDecimals)}
    - New Take Profit: $${newTakeProfit.toFixed(priceDecimals)}
    
    Current Market Context for Your Analysis:
    - Current Price: $${price.toFixed(priceDecimals)}
    - Key Support: $${support.toFixed(priceDecimals)}
    - Key Resistance: $${resistance.toFixed(priceDecimals)}
    - 1-hour VWAP: $${(vwap['1h'] ?? 0).toFixed(priceDecimals)}
    - 21 EMA (Trend): $${(emas['21'] ?? 0).toFixed(priceDecimals)}

    Your Task:
    1.  **Analyze the New Stop Loss**: Is the new SL technically sound? Is it placed behind a logical structure (like a recent swing low, support, or a key EMA/VWAP), or is it in "no-man's land" where it might be hit by normal volatility? Does it make the risk too wide or unnecessarily tight?
    2.  **Analyze the New Take Profit**: Is the new TP targeting a realistic level (like key resistance, support, or a VWAP level)? Is it too ambitious or too conservative given the market context?
    3.  **Analyze Risk/Reward**: Calculate the new Risk-to-Reward ratio based on the entry price and the new SL/TP. Is it favorable (ideally > 1.5)?
    4.  **Formulate Feedback**: Provide one-sentence feedback. 
        - If the adjustment is poor (e.g., bad R:R, illogical SL), MUST start the feedback with "Warning:". Example: "Warning: Your stop loss is now in front of the key support at $${support.toFixed(priceDecimals)}, making it vulnerable."
        - If the adjustment is good or reasonable, provide positive or neutral reinforcement. Example: "Solid adjustment. Tightening the stop improves the R:R to 2.5:1 while still being protected by the 21 EMA."

    Generate the JSON object with your feedback.
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: adjustmentFeedbackSchema,
      }
    });
    
    const text = response.text.trim();
    return JSON.parse(text) as AdjustmentFeedback;
  } catch (error) {
    console.error("Error processing Gemini adjustment analysis:", error);
    return "Could not retrieve adjustment feedback from AI.";
  }
};

const optimizedPlanSchema = {
    type: Type.OBJECT,
    properties: {
        newStopLoss: { type: Type.NUMBER, description: "The newly calculated, optimized stop loss price." },
        newTakeProfit: { type: Type.NUMBER, description: "The newly calculated, optimized take profit price." },
        newPositionSize: { type: Type.NUMBER, description: "The newly calculated position size that adheres to the user's risk constraint." },
        explanation: { type: Type.STRING, description: "A clear, concise explanation of the logic behind the new plan, addressing the user's comment directly." },
    },
    required: ['newStopLoss', 'newTakeProfit', 'newPositionSize', 'explanation'],
};

export const getOptimizedTradePlan = async (
    userComment: string,
    originalAnalysis: AIAnalysisResult,
    marketData: MarketData,
    config: BotConfig
): Promise<OptimizedTradePlan | string> => {
    if (!process.env.API_KEY) {
        return "Error: API_KEY is not configured.";
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const { price, support, resistance, vwap, emas } = marketData;
    const priceDecimals = price > 100 ? 2 : 4;
    
    const prompt = `
        You are a master risk management AI for a proprietary trading firm. A trader has an initial trade idea but needs you to adjust it based on a specific strategic comment or risk constraint they have provided. Your task is to read their comment, understand the core constraint, and then recalculate a complete, executable trade plan (SL, TP, and Position Size) that honors their request while remaining technically sound.

        User's Strategic Comment:
        "${userComment}"

        Initial AI Trade Idea:
        - Direction: ${originalAnalysis.tradeDirection}
        - Key Observation: ${originalAnalysis.keyObservation}
        - Entry: $${originalAnalysis.entryPrice.toFixed(priceDecimals)}

        Trader's Account Config:
        - Account Balance: $${config.accountBalance}

        Current Market Context:
        - Current Price: $${price.toFixed(priceDecimals)}
        - Key Support: $${support.toFixed(priceDecimals)}
        - Key Resistance: $${resistance.toFixed(priceDecimals)}
        - 1-hour VWAP: $${(vwap['1h'] ?? 0).toFixed(priceDecimals)}
        - 21 EMA (Trend): $${(emas['21'] ?? 0).toFixed(priceDecimals)}

        Your Task (Follow these steps precisely):
        1.  **Parse User's Intent**: First, fully understand the user's comment. Identify the primary constraint. Is it a maximum dollar loss (e.g., "$100 max risk")? A drawdown limit (e.g., "3% daily limit, already down 2%")? A specific Risk/Reward target? **This constraint OVERRIDES any default risk settings.**
        2.  **Determine Max Dollar Risk**: Based on the user's comment and their account balance, calculate the absolute maximum dollar amount they can risk on this trade. For example, if they have a $10k account, are down 2% ($200) and have a 3% ($300) daily limit, their max risk for this trade is $100.
        3.  **Set a Technical Stop Loss**: Determine the most logical price for the new Stop Loss. It should be technically sound (e.g., just beyond key support/resistance, a recent swing point, or a major VWAP/EMA level).
        4.  **Calculate Position Size**: This is the most critical step. Based on the max dollar risk you determined and the distance between the entry price and your new Stop Loss, calculate the precise position size. The formula is: Position Size = (Max Dollar Risk) / (Distance between Entry and Stop-Loss).
        5.  **Set a Technical Take Profit**: Calculate a new Take Profit price that targets a logical level (e.g., the next area of liquidity, a key technical level) and ensures a favorable risk-to-reward ratio (aim for at least 1.5:1 if market structure allows).
        6.  **Formulate Explanation**: Write a concise explanation that directly addresses the user's comment. Explain how the new plan meets their specific risk constraint. Example: "To keep your risk under the specified $100 limit, I've adjusted the position size to X. The Stop Loss is placed at $Y, just below the key support level, ensuring the trade adheres to your daily drawdown rule."

        Now, generate the JSON object adhering to the schema.
    `;

    try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: optimizedPlanSchema,
          }
        });
        
        const text = response.text.trim();
        return JSON.parse(text) as OptimizedTradePlan;
    } catch (error) {
        console.error("Error processing Gemini optimization:", error);
        return "AI failed to generate an optimized plan. Please check your comment for clarity.";
    }
};

const debriefSchema = {
    type: Type.OBJECT,
    properties: {
        outcome: { type: Type.STRING, enum: ['Win', 'Loss', 'Invalidated', 'In Progress'], description: "The result of the trade: 'Win' (TP hit), 'Loss' (SL hit), 'Invalidated' (price moved away without entry), or 'In Progress'." },
        explanation: { type: Type.STRING, description: "A concise, one-sentence explanation of what happened to the trade idea and why, based on the subsequent price action." },
        keyLesson: { type: Type.STRING, description: "A one-sentence, actionable trading lesson a human can learn from this specific outcome." },
    },
    required: ['outcome', 'explanation', 'keyLesson'],
};

export const getTradeDebrief = async (
    originalAnalysis: AIAnalysisResult,
    marketData: MarketData
): Promise<TradeDebriefResult | string> => {
    if (!process.env.API_KEY) {
        return "Error: API_KEY is not configured.";
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const { price, candleHistory } = marketData;
    const priceDecimals = price > 100 ? 2 : 4;
    const subsequentCandles = candleHistory.slice(-15); // Analyze the last 15 candles since the signal
    
    const subsequentCandlesSummary = subsequentCandles.map(c => 
        `{O: ${c.open.toFixed(priceDecimals)}, H: ${c.high.toFixed(priceDecimals)}, L: ${c.low.toFixed(priceDecimals)}, C: ${c.close.toFixed(priceDecimals)}}`
    ).join(', ');

    const prompt = `
        You are a trading coach AI. Your task is to debrief a trade idea that was generated earlier, providing a clear outcome and a key learning lesson.

        Original Trade Idea:
        - Direction: ${originalAnalysis.tradeDirection === 'NEUTRAL' ? originalAnalysis.speculativeDirection : originalAnalysis.tradeDirection}
        - Entry Price: $${originalAnalysis.entryPrice.toFixed(priceDecimals)}
        - Stop Loss: $${originalAnalysis.stopLoss.toFixed(priceDecimals)}
        - Take Profit: $${originalAnalysis.takeProfit.toFixed(priceDecimals)}
        - Initial Rationale: "${originalAnalysis.keyObservation}"

        Subsequent Market Action:
        - The current price is $${price.toFixed(priceDecimals)}.
        - The 15 candles AFTER the signal was generated are: ${subsequentCandlesSummary}

        Your Analytical Process:
        1.  **Determine the Outcome**: Based on the subsequent candles, did price first hit the 'Take Profit' or the 'Stop Loss' level?
            - If TP was hit first, the outcome is 'Win'.
            - If SL was hit first, the outcome is 'Loss'.
            - If price moved significantly away from the entry without triggering it, the setup is 'Invalidated'.
            - If neither SL nor TP was hit and the price is still near entry, it's 'In Progress'.
        2.  **Explain the "Why"**: Look at the candle data. Was there a strong momentum candle that pushed price to the target? Was there a sharp reversal? Was the initial rationale confirmed or proven wrong by the subsequent order flow? Provide a single, clear sentence.
        3.  **Extract a Key Lesson**: This is the most important part. What is the single most valuable lesson a trader can learn from observing this price action? Avoid generic advice. It must be specific to this trade.
            - Example Good Lesson: "Lesson: Even with strong bearish signals, failing to break below the session's VWAP often indicates absorption and can lead to a sharp reversal."
            - Example Bad Lesson: "Lesson: Always use a stop loss."

        Now, generate the JSON object with your debrief.
    `;

    try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: debriefSchema,
          }
        });
        
        const text = response.text.trim();
        return JSON.parse(text) as TradeDebriefResult;
    } catch (error) {
        console.error("Error processing Gemini debrief:", error);
        return "AI failed to generate a trade debrief. The market action may have been too complex.";
    }
};
