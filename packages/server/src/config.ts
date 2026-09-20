import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  geminiApiKey: required('GEMINI_API_KEY'),
  /** gemini-2.0-flash for fast/cheap steps, gemini-2.0-pro for complex reasoning */
  models: {
    fast: process.env.GEMINI_MODEL_FAST || 'gemini-3.7-flash',
    reasoning: process.env.GEMINI_MODEL_REASONING || 'gemini-3.8-flash',
  },
} as const;
