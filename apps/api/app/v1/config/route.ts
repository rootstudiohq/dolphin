import { OpenAITranslationProvider } from '@repo/provider/openai';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  const provider = new OpenAITranslationProvider({ apiKey });
  console.log(`provider.config()`, await provider.config());
  return NextResponse.json(await provider.config());
}
