// ***********************************************
// ≡ƒÜ¿ CRITICAL FIX: Initialize the Gemini Client
// ***********************************************
// 1. Read the environment variable using the Node.js/Vercel process.env.
// 2. Initialize the GoogleGenAI client with the key.
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // <-- **CHANGED THIS LINE**

// Check if the key is missing and throw an error.
if (!GEMINI_API_KEY) {
    throw new Error("API_KEY is not configured.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
// ***********************************************
