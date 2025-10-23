import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import logger from '../utils/logger';

// Types for RAG documents and embeddings
export interface TrainingDoc {
  id?: string;
  text: string;
  embedding?: number[];
  metadata?: {
    source?: string;
    category?: string;
  };
}

interface ScoredDoc extends TrainingDoc {
  similarity: number;
}

export interface RagResult {
  context: string;
  matchedDocs: { id?: string; text: string; similarity: number }[];
}

// Initialize Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// In-memory store for training data with PRE-GENERATED mock embeddings
// (to avoid free tier quota limits)
const trainingDocs: TrainingDoc[] = [
  {
    id: 'doc_1',
    text: "I am applying for a job position. If the lead is interested, share the meeting booking link: https://cal.com/example",
    embedding: Array(768).fill(0).map((_, i) => Math.sin(i / 100) * 0.5 + 0.3), // Mock embedding 1
    metadata: { category: 'job-application' }
  },
  {
    id: 'doc_2',
    text: "We offer AI-powered lead generation platform with real-time IMAP sync",
    embedding: Array(768).fill(0).map((_, i) => Math.cos(i / 100) * 0.5 + 0.2), // Mock embedding 2
    metadata: { category: 'product-info' }
  },
  {
    id: 'doc_3',
    text: "Our platform supports multi-channel outreach on Twitter, LinkedIn, email, and phone with personalized sequences",
    embedding: Array(768).fill(0).map((_, i) => Math.sin(i / 50) * 0.4 + 0.25), // Mock embedding 3
    metadata: { category: 'product-features' }
  }
];

// Helper to compute cosine similarity between two vectors
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vectors must have same length');
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Initialize RAG (no-op now since we use mock embeddings)
export async function initializeRAG(): Promise<void> {
  logger.info('RAG initialized with pre-generated mock embeddings');
}

// Alias for compatibility
export async function initializeEmbeddings(): Promise<void> {
  return initializeRAG();
}

// Generate mock embedding for new text (deterministic based on length/content)
function getMockEmbedding(text: string): number[] {
  const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return Array(768).fill(0).map((_, i) => {
    const seed = (hash + i) % 1000;
    return Math.sin(seed / 100) * 0.3 + 0.2;
  });
}

// Find similar training docs for the input text
export async function findSimilarDocs(text: string, topK: number = 2): Promise<TrainingDoc[]> {
  logger.info(`Finding similar docs for text: ${text.substring(0, 50)}...`);
  
  try {
    // Generate mock embedding for input text
    const queryEmbedding = getMockEmbedding(text);
    
    // Score all training docs
    const scoredDocs: ScoredDoc[] = trainingDocs
      .filter(doc => doc.embedding !== undefined)
      .map(doc => ({
        ...doc,
        similarity: cosineSimilarity(queryEmbedding, doc.embedding!)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
    
    logger.info(`Found ${scoredDocs.length} similar docs, top similarity: ${scoredDocs[0]?.similarity.toFixed(3)}`);
    
    return scoredDocs;
  } catch (err) {
    logger.error('Error finding similar docs:', err);
    throw err;
  }
}

// Retrieve context for RAG
export async function retrieveContext(emailBody: string, topK: number = 2): Promise<RagResult> {
  try {
    const similarDocs = await findSimilarDocs(emailBody, topK);
    
    const context = similarDocs.map(doc => doc.text).join('\n---\n');
    const matchedDocs = similarDocs.map(doc => ({
      id: doc.id,
      text: doc.text,
      similarity: (doc as ScoredDoc).similarity
    }));
    
    return { context, matchedDocs };
  } catch (err) {
    logger.error('Error retrieving context:', err);
    return { context: '', matchedDocs: [] };
  }
}

// Add new training doc with mock embedding
export async function addTrainingDoc(text: string, metadata?: TrainingDoc['metadata']): Promise<void> {
  try {
    const id = `doc_${Date.now()}`;
    const embedding = getMockEmbedding(text);
    trainingDocs.push({ id, text, embedding, metadata });
    logger.info('Added new training doc with mock embedding', { id });
  } catch (err) {
    logger.error('Failed to add training doc:', err);
    throw err;
  }
}

// Get all training docs
export function getAllTrainingDocs(): TrainingDoc[] {
  return trainingDocs.map(({ id, text, metadata }) => ({ id, text, metadata }));
}