import { GoogleGenAI, Type } from "@google/genai";
import { MarketData, BotConfig, AIAnalysisResult, AdjustmentFeedback, OptimizedTradePlan, FootprintDataPoint } from '../types';

// ***********************************************
// 🚨 CRITICAL FIX: Initialize the Gemini Client
// ***********************************************
// 1. Read the environment variable using the VITE_ prefix.
// 2. Initialize the GoogleGenAI client with the key.
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Check if the key is missing and throw an error for the dashboard to display.
if (!GEMINI_API_KEY) {
    throw new Error("API_KEY is not configured. Please set VITE_GEMINI_API_KEY in your environment variables.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
// ***********************************************

const responseSchema = {
// ... rest of the file remains the same ...
