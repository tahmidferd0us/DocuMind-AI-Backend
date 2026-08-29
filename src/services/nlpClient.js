import axios from 'axios';
import FormData from 'form-data';
import { env } from '../config/env.js';
import { AppError } from '../core/errors/AppError.js';

const client = axios.create({ baseURL: env.NLP_SERVICE_URL, timeout: env.NLP_TIMEOUT_MS });

const unwrap = async (request) => {
  try {
    const response = await request;
    return response.data?.data ?? response.data;
  } catch (error) {
    if (error.response) throw new AppError(error.response.data?.detail ?? 'The NLP service rejected the request', 502, 'NLP_SERVICE_ERROR');
    if (error.code === 'ECONNABORTED') throw new AppError('The NLP service timed out', 504, 'NLP_SERVICE_TIMEOUT');
    throw new AppError(`The NLP service is unreachable at ${env.NLP_SERVICE_URL}`, 503, 'NLP_SERVICE_UNAVAILABLE');
  }
};

const multipart = (fields) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value?.buffer) form.append(key, value.buffer, { filename: value.filename });
    else form.append(key, value);
  }
  return form;
};

export const nlpClient = {
  health: () => unwrap(client.get('/health')),

  parseDocument: (buffer, filename) => {
    const form = multipart({ file: { buffer, filename } });
    return unwrap(client.post('/api/v1/parse', form, { headers: form.getHeaders() }));
  },

  summarize: (text, options = {}) =>
    unwrap(
      client.post('/api/v1/summarize', {
        text,
        extractive_sentences: options.extractiveSentences ?? 5,
        extractive_method: options.extractiveMethod ?? 'lexrank',
        abstractive_format: options.abstractiveFormat ?? 'paragraph',
        abstractive_length: options.abstractiveLength ?? 'standard',
        focus_topic: options.focusTopic ?? null,
      }),
    ),

  extractEntities: (text) => unwrap(client.post('/api/v1/entities', { text })),

  computeAnalytics: (text, filename = 'document') => unwrap(client.post('/api/v1/analytics', { text, filename })),

  indexForRag: (buffer, filename, docId) => {
    const form = multipart({ file: { buffer, filename }, doc_id: docId });
    return unwrap(client.post('/api/v1/rag/index', form, { headers: form.getHeaders() }));
  },

  indexTextForRag: (docId, pages) => unwrap(client.post('/api/v1/rag/index-text', { doc_id: docId, pages })),

  queryRag: (docId, question, topK = 4, chatHistory = []) =>
    unwrap(client.post('/api/v1/rag/query', { doc_id: docId, question, top_k: topK, chat_history: chatHistory })),

  exportReport: async (format, payload) => {
    const response = await client.post(`/api/v1/export/${format}`, payload, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  },

  evaluate: (reference, candidate) => unwrap(client.post('/api/v1/evaluate', { reference, candidate })),
};
