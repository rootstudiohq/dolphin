import { LLMTranslatorConfig } from '@repo/base/config';
import { StreamObjectResult } from 'ai';

export interface TranslationPayload {
  context?: string;
  sourceLanguage: string;
  targetLanguages: string[];
  contents: {
    key: string;
    source: string;
    notes?: string[];
  }[];
}

export interface TranslationProvider {
  translate(
    payload: TranslationPayload,
  ): Promise<StreamObjectResult<any, any, any>>;
  config(): Promise<LLMTranslatorConfig>;
}
