import { Config, LLMTranslatorConfig } from '@repo/base/config';
import { logger } from '@repo/base/logger';
import { OpenAITranslationProvider } from '@repo/provider/openai';

import { TranslationBatch } from '../../batch.js';
import { LocalizationEntity } from '../../entity.js';
import { Translator } from '../index.js';
import { translateEntities } from '../translation.js';

export type OpenAITokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export class OpenAITranslator implements Translator {
  usage: OpenAITokenUsage;
  maxRetry: number;
  provider: OpenAITranslationProvider;

  constructor(apiKey: string, maxRetry: number = 1) {
    this.usage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    this.maxRetry = maxRetry;
    this.provider = new OpenAITranslationProvider({ apiKey });
  }

  async config(): Promise<LLMTranslatorConfig> {
    return this.provider.config();
  }

  async translate(
    entities: LocalizationEntity[],
    config: Config,
    onProgress?: (progress: number) => void,
  ): Promise<LocalizationEntity[]> {
    return translateEntities({
      agent: 'openai',
      entities,
      config,
      maxRetry: this.maxRetry,
      translationConfig: this.config.bind(this),
      translationBatch: this.translateBatch.bind(this),
      onProgress,
    });
  }

  additionalInfo() {
    return {
      usage: this.usage,
    };
  }

  private async translateBatch({
    batch,
    config,
    translatorConfig,
    translatedCount,
    totalCount,
    maxPercentage,
    onProgress,
  }: {
    batch: TranslationBatch;
    config: Config;
    translatorConfig: LLMTranslatorConfig;
    translatedCount: number;
    totalCount: number;
    maxPercentage: number;
    onProgress?: (progress: number) => void;
  }) {
    logger.info(
      `Translating batch from ${batch.sourceLanguage} to ${batch.targetLanguages.join(
        ', ',
      )}, keys: ${batch.contents.map((c) => c.key).join(', ')}`,
    );
    const stream = await this.provider.translate({
      context: config.globalContext,
      sourceLanguage: batch.sourceLanguage,
      targetLanguages: batch.targetLanguages,
      contents: batch.contents,
    });

    for await (const s of stream.fullStream) {
      // Empty loop to consume the stream so we can get the final object
    }

    const translationResponse = await stream.object;
    const usage = await stream.usage;

    // Update usage
    this.usage.promptTokens += usage.promptTokens;
    this.usage.completionTokens += usage.completionTokens;
    this.usage.totalTokens += usage.totalTokens;

    if (Object.keys(translationResponse).length === 0) {
      throw new Error('Failed to receive translation response object');
    }

    return translationResponse;
  }
}
