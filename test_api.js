import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = 'AIzaSyA-_99jab9cZ2_55Ko41stGqz1R4cb9RjA';
const genAI = new GoogleGenerativeAI(apiKey);

async function testAPI() {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent('Say hello');
    const response = await result.response;
    console.log('✅ API Key Works!');
    console.log('Response:', response.text());
  } catch (error) {
    console.error('❌ API Key Error:', error.message);
  }
}

testAPI();