import { NextResponse } from 'next/server';
import 'server-only';

export enum ApiErrorCode {
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
  MISSING_AGENT_TRANSLATION_RESPONSE = 10000,
  INVALID_AGENT_TRANSLATION_RESPONSE = 10001,
}

export class ApiError extends Error {
  status: number;
  constructor(
    public code: ApiErrorCode,
    public message: string,
    status?: number,
  ) {
    super(message);
    this.status =
      status ||
      {
        [ApiErrorCode.BAD_REQUEST]: 400,
        [ApiErrorCode.UNAUTHORIZED]: 401,
        [ApiErrorCode.NOT_FOUND]: 404,
        [ApiErrorCode.INTERNAL_SERVER_ERROR]: 500,
        [ApiErrorCode.MISSING_AGENT_TRANSLATION_RESPONSE]: 500,
        [ApiErrorCode.INVALID_AGENT_TRANSLATION_RESPONSE]: 500,
      }[code] ||
      500;
  }
}

export type ApiResponse<T> = NextResponse<T | ApiErrorResponse>;

export type ApiErrorResponse = {
  message: string;
  code: number;
};

export function createErrorResponse({
  message,
  code,
  status,
}: {
  message: string;
  code: ApiErrorCode;
  status: number;
}): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { message: message, code: code },
    { status: status },
  );
}

export function withApiHandler(
  handler: (...params: any) => Promise<NextResponse<any>>,
  beforeResponseHandler?: (error: any) => void,
) {
  return async (...params: any) => {
    let response: NextResponse<any>;
    try {
      response = await handler(...params);
    } catch (error) {
      console.error(`API handle thrown an error: ${error}`);
      response = createErrorResponse(createErrorResponseJson(error));
    }
    if (beforeResponseHandler) {
      beforeResponseHandler(response);
    }
    return response;
  };
}

export function createErrorResponseJson(error: any) {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      code: error.code,
      status: error.status,
    };
  } else {
    console.error(
      `Creating error response: API handle thrown an error: ${error}`,
    );
    return {
      message: 'Internal server error',
      code: ApiErrorCode.INTERNAL_SERVER_ERROR,
      status: 500,
    };
  }
}
