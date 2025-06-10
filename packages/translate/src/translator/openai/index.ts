import { Config, LLMTranslatorConfig } from '@repo/base/config';
import { logger } from '@repo/base/logger';
import { OpenAITranslationProvider } from '@repo/provider/openai';

import { TranslationBatch } from '../../batch.js';
import { LocalizationEntity } from '../../entity.js';
import { calTokens } from '../../utils.js';
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

  constructor({
    apiKey,
    model,
    maxRetry = 1,
  }: {
    apiKey: string;
    model?: string;
    maxRetry: number;
  }) {
    this.usage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    this.maxRetry = maxRetry;
    this.provider = new OpenAITranslationProvider({ apiKey, model });
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
    const expectedChunkTokenCount =
      batch.expectedTokens * (1 + translatorConfig.buffer);
    let receivedChunkTokenCount = 0;
    try {
      const stream = await this.provider.translate({
        context: config.globalContext,
        sourceLanguage: batch.sourceLanguage,
        targetLanguages: batch.targetLanguages,
        contents: batch.contents,
      });

      logger.info(`Start openai translating streaming...`);
      try {
        for await (const s of stream.partialObjectStream) {
          // Log partial results and handle them appropriately
          logger.debug(`Received partial translation: ${JSON.stringify(s)}`);
          receivedChunkTokenCount += calTokens(
            translatorConfig.tokenizer,
            translatorConfig.tokenizerModel,
            JSON.stringify(s),
          );
          if (onProgress) {
            onProgress(
              translatedCount / totalCount +
                Math.min(
                  receivedChunkTokenCount / expectedChunkTokenCount,
                  ((batch.contents.length * batch.targetLanguages.length) /
                    totalCount) *
                    maxPercentage,
                ),
            );
          }
        }
      } catch (streamError) {
        logger.error(`Error during stream processing: ${streamError}`);
        throw streamError;
      }

      logger.info(`Streaming finished`);
      const translationResponse = await stream.object;
      logger.info(
        `Translation response: ${JSON.stringify(translationResponse)}`,
      );
      const usage = await stream.usage;
      logger.info(`Usage: ${JSON.stringify(usage)}`);

      // Update usage
      this.usage.promptTokens += usage.promptTokens;
      this.usage.completionTokens += usage.completionTokens;
      this.usage.totalTokens += usage.totalTokens;

      if (Object.keys(translationResponse).length === 0) {
        throw new Error('Failed to receive translation response object');
      }

      return translationResponse;
    } catch (error) {
      logger.error(`Error translating openai batch: ${error}`);
      throw error;
    }
  }
}
