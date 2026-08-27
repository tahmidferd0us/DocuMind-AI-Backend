import axios from 'axios';
import FormData from 'form-data';

const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: NLP_SERVICE_URL,
  timeout: 60000,
});

export const nlpClient = {
  /**
   * Check NLP microservice liveness.
   */
  async health() {
    const res = await client.get('/health');
    return res.data;
  },

  /**
   * Parse a file buffer (.pdf, .docx, .txt).
   */
  async parseDocument(fileBuffer, filename) {
    const form = new FormData();
    form.append('file', fileBuffer, { filename });
    const res = await client.post('/api/v1/parse', form, {
      headers: form.getHeaders(),
    });
    return res.data.data;
  },

  /**
   * Generate dual extractive and abstractive summaries.
   */
  async summarize(text, options = {}) {
    const res = await client.post('/api/v1/summarize', {
      text,
      extractive_sentences: options.extractiveSentences || 5,
      extractive_method: options.extractiveMethod || 'lexrank',
      abstractive_format: options.abstractiveFormat || 'paragraph',
      abstractive_length: options.abstractiveLength || 'standard',
      focus_topic: options.focusTopic || null,
    });
    return res.data.data;
  },

  /**
   * Extract named entities (spaCy) and keyphrases (KeyBERT).
   */
  async extractEntities(text) {
    const res = await client.post('/api/v1/entities', { text });
    return res.data.data;
  },

  /**
   * Compute reading analytics and readability scores.
   */
  async computeAnalytics(text, filename = 'document') {
    const res = await client.post('/api/v1/analytics', { text, filename });
    return res.data.data;
  },

  /**
   * Index document into in-memory FAISS store for RAG Q&A session.
   */
  async indexForRag(fileBuffer, filename, docId) {
    const form = new FormData();
    form.append('file', fileBuffer, { filename });
    form.append('doc_id', docId);
    const res = await client.post('/api/v1/rag/index', form, {
      headers: form.getHeaders(),
    });
    return res.data.data;
  },

  /**
   * Ask question against indexed document with citations.
   */
  async queryRag(docId, question, topK = 4, chatHistory = []) {
    const res = await client.post('/api/v1/rag/query', {
      doc_id: docId,
      question,
      top_k: topK,
      chat_history: chatHistory,
    });
    return res.data.data;
  },

  /**
   * Export analytical report as DOCX binary.
   */
  async exportDocx(reportPayload) {
    const res = await client.post('/api/v1/export/docx', reportPayload, {
      responseType: 'arraybuffer',
    });
    return res.data;
  },

  /**
   * Export analytical report as PDF binary.
   */
  async exportPdf(reportPayload) {
    const res = await client.post('/api/v1/export/pdf', reportPayload, {
      responseType: 'arraybuffer',
    });
    return res.data;
  },

  /**
   * Evaluate candidate summary against reference summary (ROUGE & BLEU).
   */
  async evaluate(reference, candidate) {
    const res = await client.post('/api/v1/evaluate', { reference, candidate });
    return res.data.data;
  },
};
