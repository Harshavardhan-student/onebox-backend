import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../utils/logger';
import { retrieveContext } from './ragService';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

interface SuggestedReply {
  reply: string;
  ragContext?: string;
  matchedDocs?: { id: string; similarity: number }[];
  error?: string;
}

interface CategorizationResult {
  category: 'Interested' | 'Meeting Booked' | 'Not Interested' | 'Spam' | 'Out of Office' | 'Unknown';
  confidence?: number;
  reasoning?: string;
}

const CATEGORIES = [
  'Interested',
  'Meeting Booked',
  'Not Interested',
  'Spam',
  'Out of Office'
];

// Generate contextual fallback reply based on category and content
function generateFallbackReply(emailBody: string, ragContext: string, category?: string): string {
  const text = emailBody.toLowerCase();

  // Not Interested - polite decline
  if (category === 'Not Interested' || text.includes('not interested')) {
    return "Thank you for considering us. We appreciate the feedback and hope we can work together in the future if circumstances change.";
  }

  // Spam - no reply
  if (category === 'Spam' || text.includes('click here')) {
    return "This email appears to be spam and typically does not warrant a response.";
  }

  // Out of Office - acknowledge
  if (category === 'Out of Office' || text.includes('out of office')) {
    return "Thank you for the auto-reply. I'll follow up when you're back.";
  }

  // Meeting Booked - confirmation
  if (category === 'Meeting Booked') {
    return "Perfect! I've confirmed our meeting. Looking forward to speaking with you then. Thank you!";
  }

  // Default - Interested replies
  const templates = [
    "Thank you for reaching out! I appreciate your interest. Based on your message, I'd like to discuss this further. Could we schedule a time to connect?",
    "Thanks for getting in touch! This sounds like an interesting opportunity. I'd be happy to share more details. When would be a good time for you?",
    "I appreciate your inquiry! Your interest aligns well with what we're working on. Let's schedule a meeting to explore this together.",
    "Thank you for your message! I'm excited about the possibility. Could we set up a call to discuss the details?"
  ];

  // If RAG context mentions "meeting booking link", include it
  if (ragContext.toLowerCase().includes('meeting booking') || ragContext.toLowerCase().includes('cal.com')) {
    return `${templates[0]} You can also book a time here: https://cal.com/example`;
  }

  return templates[Math.floor(Math.random() * templates.length)];
}

// Improved fallback categorization with better keyword matching
function fallbackCategorizeEmail(emailText: string): CategorizationResult {
  const text = emailText.toLowerCase();

  // Check for Spam first (high priority)
  if (text.includes('click here') || text.includes('free money') || text.includes('unsubscribe') || 
      text.includes('winner') || text.includes('claim prize') || text.match(/\b(spam|scam)\b/)) {
    return { category: 'Spam', confidence: 0.8, reasoning: 'Spam keywords detected' };
  }

  // Check for "Out of Office"
  if (text.includes('out of office') || text.includes('auto reply') || text.includes('away')) {
    return { category: 'Out of Office', confidence: 0.8, reasoning: 'Out of office keywords detected' };
  }

  // Check for "Not Interested" (must check BEFORE "Interested")
  if (text.includes('not interested') || text.includes("don't need") || 
      text.includes('no thanks') || text.includes('not suitable')) {
    return { category: 'Not Interested', confidence: 0.8, reasoning: 'Not interested keywords detected' };
  }

  // Check for "Meeting Booked"
  if ((text.includes('meeting') || text.includes('call') || text.includes('schedule')) && 
      (text.includes('booked') || text.includes('confirmed') || text.includes('scheduled') || text.includes('next'))) {
    return { category: 'Meeting Booked', confidence: 0.8, reasoning: 'Meeting booking keywords detected' };
  }

  // Check for "Interested" (lowest priority, most generic)
  if (text.includes('interested') || text.includes('love') || text.includes('great') || 
      text.includes('amazing') || text.includes('excited') || text.includes('partnership')) {
    return { category: 'Interested', confidence: 0.6, reasoning: 'Interest keywords detected' };
  }

  return { category: 'Unknown', confidence: 0, reasoning: 'No clear keywords matched' };
}

// Categorize email using Gemini (with improved fallback)
export async function categorizeEmail(emailText: string): Promise<CategorizationResult> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      logger.warn('GEMINI_API_KEY not set, using fallback');
      return fallbackCategorizeEmail(emailText);
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `Categorize the following email into ONE of these categories: ${CATEGORIES.join(', ')}.

Email:
${emailText}

Respond with ONLY a JSON object in this format:
{
  "category": "one of the categories",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    logger.info('Gemini categorization response', { response: responseText });
    
    const parsed = JSON.parse(responseText);

    if (!CATEGORIES.includes(parsed.category)) {
      parsed.category = 'Unknown';
    }

    logger.info('Email categorized via Gemini', { category: parsed.category, confidence: parsed.confidence });
    return parsed as CategorizationResult;
  } catch (err: any) {
    logger.warn('Categorization via Gemini failed, using fallback', { error: err.message });
    return fallbackCategorizeEmail(emailText);
  }
}

// Generate suggested reply with RAG context
export async function suggestReply(emailBody: string): Promise<SuggestedReply> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      logger.warn('GEMINI_API_KEY not set');
      return {
        reply: 'Error: GEMINI_API_KEY not configured',
        error: 'API key missing'
      };
    }

    // Retrieve RAG context
    const { context: ragContext, matchedDocs } = await retrieveContext(emailBody, 2);
    
    // Get category for contextual reply
    const categorization = await categorizeEmail(emailBody);

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `You are a professional business email responder. Generate a concise, professional reply to the following email.

${ragContext ? `Use this context for the reply:\n${ragContext}\n---\n` : ''}

Email category: ${categorization.category}

Email to reply to:
${emailBody}

Generate a professional, friendly reply that addresses the email. Keep it under 100 words.`;

    logger.info('Calling Gemini for reply generation', { category: categorization.category });
    
    const result = await model.generateContent(prompt);
    const reply = result.response.text().trim();
    
    logger.info('Gemini reply generated successfully', { replyLength: reply.length });

    return {
      reply,
      ragContext,
      matchedDocs: matchedDocs.map(d => ({ id: d.id || '', similarity: d.similarity }))
    };
  } catch (err: any) {
    logger.warn('Reply generation via Gemini failed, using fallback', { error: err.message });
    
    // Fallback to template-based reply
    const { context: ragContext, matchedDocs } = await retrieveContext(emailBody, 2);
    const categorization = await categorizeEmail(emailBody);
    const fallbackReply = generateFallbackReply(emailBody, ragContext, categorization.category);

    return {
      reply: fallbackReply,
      ragContext,
      matchedDocs: matchedDocs.map(d => ({ id: d.id || '', similarity: d.similarity }))
    };
  }
}

// Health check
export async function testGeminiConnection(): Promise<boolean> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    await model.generateContent('Say ok');
    logger.info('Gemini connection successful');
    return true;
  } catch (err: any) {
    logger.error('Gemini connection failed', { error: err.message });
    return false;
  }
}