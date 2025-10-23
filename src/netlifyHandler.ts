import { HandlerEvent, HandlerContext, Handler } from '@netlify/functions';
import serverless from 'serverless-http';
import { app } from './server';

// Wrap the Express app with serverless-http
const serverlessApp = serverless(app);

// Type for serverless-http response
type ServerlessResponse = {
  statusCode: number;
  body: string;
  headers?: { [key: string]: string };
};

// Seed initial data if needed
let seeded = false;
async function seedInitialData(event: HandlerEvent) {
  if (seeded) return;
  
  try {
    // Create a seed request
    const seedEvent = {
      ...event,
      path: '/emails/seed',
      httpMethod: 'POST',
      body: null
    };
    
    await serverlessApp(seedEvent, {} as HandlerContext);
    seeded = true;
    console.log('Initial data seeded successfully');
  } catch (error) {
    console.error('Error seeding initial data:', error);
  }
}

// Export the Netlify Functions handler
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Add logging for debugging
  console.log('Request path:', event.path);
  console.log('Request method:', event.httpMethod);
  
  try {
    // On first GET request to /api/emails, seed initial data
    if (!seeded && event.path.startsWith('/emails') && event.httpMethod === 'GET') {
      await seedInitialData(event);
    }

    // Call the serverless handler
    const result = await serverlessApp(event, context) as ServerlessResponse;
    return {
      statusCode: result.statusCode,
      body: result.body,
      headers: result.headers || {}
    };
  } catch (error) {
    console.error('Error in handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://onebox-assessment1.netlify.app',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    };
  }
};