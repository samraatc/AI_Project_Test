import { registerAs } from '@nestjs/config';
export default registerAs('ai', () => ({
  openaiApiKey:   process.env.OPENAI_API_KEY            || '',
  primaryModel:   process.env.OPENAI_PRIMARY_MODEL      || 'gpt-4o',
  fallbackModel:  process.env.OPENAI_FALLBACK_MODEL     || 'gpt-4o-mini',
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL    || 'text-embedding-3-large',
  maxTokens:      parseInt(process.env.OPENAI_MAX_TOKENS, 10) || 8000,
  temperature:    parseFloat(process.env.OPENAI_TEMPERATURE)  || 0.1,
  qdrantHost:     process.env.QDRANT_HOST  || 'localhost',
  qdrantPort:     parseInt(process.env.QDRANT_PORT, 10) || 6333,
  qdrantApiKey:   process.env.QDRANT_API_KEY || '',
}));
