import { Handler as NetlifyHandler, HandlerEvent, HandlerContext } from '@netlify/functions';

export type HandlerResponse = {
  statusCode: number;
  body: string;
  headers?: Record<string, string>;
};

export type ServerlessHandler = (event: HandlerEvent, context: HandlerContext) => Promise<HandlerResponse>;
export type Handler = NetlifyHandler;