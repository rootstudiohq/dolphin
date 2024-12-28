import { ApiError, ApiErrorCode, withApiHandler } from '@/lib/response';
import { openai } from '@ai-sdk/openai';
import { OpenAITranslationProvider } from '@repo/provider/openai';
import { ObjectStreamPart, StreamingTextResponse, streamObject } from 'ai';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

export const runtime = 'edge';

export const dynamic = 'force-dynamic';

const RequestPayloadSchema = z.object({
  provider: z.enum(['openai']),
  model: z.optional(z.string()),
  context: z.optional(z.string()),
  sourceLanguage: z.string(),
  targetLanguages: z.array(z.string()),
  contents: z.array(
    z.object({
      key: z.string(),
      source: z.string(),
      notes: z.optional(z.array(z.string())),
    }),
  ),
});

type RequestPayload = z.infer<typeof RequestPayloadSchema>;

export async function POST(...params: any): Promise<any> {
  return withApiHandler(handlePOSTRequest)(...params);
}

async function handlePOSTRequest(request: NextRequest): Promise<any> {
  let requestJSON;
  try {
    requestJSON = await request.json();
  } catch (error) {
    throw new ApiError(
      ApiErrorCode.BAD_REQUEST,
      'Failed to parse request JSON',
    );
  }
  const requestBody = await RequestPayloadSchema.safeParseAsync(requestJSON);
  if (!requestBody.success) {
    const validationError = fromZodError(requestBody.error);
    throw new ApiError(ApiErrorCode.BAD_REQUEST, validationError.message);
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  const payload: RequestPayload = requestBody.data;
  const provider = new OpenAITranslationProvider({
    apiKey,
  });
  const result = await provider.translate(payload);

  /**
   * Technically we can just wait for full response and return it as a single JSON,
   * but it may time out since it may take some time to process which may exceed some platform's (like Vecel) limit
   * Example of waiting for full response:
   * const object = await result.object;
   * const usage = await result.usage;
   */
  const stream = new ReadableStream({
    async start(controller) {
      for await (const streamObject of result.fullStream) {
        const chunk = JSON.stringify(streamObject) + '\n'; // Format each chunk
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });

  return new StreamingTextResponse(stream, {
    headers: { 'Content-Type': 'application/json' },
  });
}
