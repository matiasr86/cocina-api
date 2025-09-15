import OpenAI from 'openai';
if (!process.env.OPENAI_API_KEY) {
  console.warn('[openai] Falta OPENAI_API_KEY en el entorno (.env)');
}
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID || undefined,
});
export default client;
