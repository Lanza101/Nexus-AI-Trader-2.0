// test_api_key.js
import { GoogleGenAI } from '@google/genai';

// NOTE: This must match the name used in geminiService.ts
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 

if (!GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY environment variable is not set.");
    // Exit code 1 means failure
    process.exit(1); 
}

// The GoogleGenAI client must be initialized with the API key
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function checkApiKey() {
  try {
    console.log("Attempting connection to Gemini API...");
    
    // Attempt a simple, cheap model list query
    // If this call succeeds, the API key is valid.
    const modelsResponse = await ai.models.list();
    
    if (modelsResponse.models && modelsResponse.models.length > 0) {
      console.log("\n✅ SUCCESS! The GEMINI_API_KEY is CORRECT and WORKING.");
      console.log(`Successfully retrieved ${modelsResponse.models.length} model definitions.`);
    } else {
      console.error("\n❌ ERROR: Connection successful, but no models found. Key may be restricted.");
    }
  } catch (error) {
    // A 400 or 403 error here means the key is invalid or lacks permissions.
    console.error("\n❌ FATAL ERROR: The API Key is likely INCORRECT or REVOKED.");
    // console.error("Details:", error.message); // Uncomment this line if you need more debug info
  }
}

checkApiKey();