import {
  Config,
  LLMTranslatorConfig,
  LLMTranslatorConfigSchema,
} from '@repo/base/config';
import { logger } from '@repo/base/logger';
import { ObjectStreamPart } from 'ai';
import fetch from 'node-fetch';
import z from 'zod';

import { TranslationBatch, createBatches } from '../../batch.js';
import { LocalizationEntity } from '../../entity.js';
import { calTokens } from '../../utils.js';
import { Translator } from '../index.js';
import { translateEntities } from '../translation.js';

export type DolphinTokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export class DolphinAPITranslator implements Translator {
  usage: DolphinTokenUsage;
  maxRetry: number;
  translatorConfig?: LLMTranslatorConfig;
  provider: string = 'openai';

  constructor(
    private apiBaseUrl: string,
    maxRetry: number = 1,
  ) {
    this.usage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
    this.maxRetry = maxRetry;
  }

  async config(): Promise<LLMTranslatorConfig> {
    if (this.translatorConfig) {
      return this.translatorConfig;
    }
    const url = new URL(this.apiBaseUrl);
    url.pathname += url.pathname.endsWith('/') ? 'config' : '/config';
    logger.info(`Fetching translator config from ${url}`);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.status < 200 || response.status >= 400) {
      try {
        const json = await response.json();
        throw new Error(
          `Failed to fetch translator config: ${
            response.status
          }, body: ${JSON.stringify(json)}`,
        );
      } catch (error) {
        throw new Error(
          `Failed to fetch translator config: ${response.status}, body: ${error}`,
        );
      }
    }
    const responseJson = await response.json();
    const configResult = LLMTranslatorConfigSchema.safeParse(responseJson);
    if (!configResult.success) {
      throw new Error(
        `Failed to parse localizer config: ${configResult.error}`,
      );
    }
    this.translatorConfig = configResult.data;
    return configResult.data;
  }

  async translate(
    entities: LocalizationEntity[],
    config: Config,
    onProgress?: (progress: number) => void,
  ): Promise<LocalizationEntity[]> {
    return translateEntities({
      entities,
      config,
      agent: 'api',
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
    const url = new URL(this.apiBaseUrl);
    url.pathname += url.pathname.endsWith('/') ? 'localize' : '/localize';
    logger.info(`Sending localize request to ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        provider: this.provider,
        context: config.globalContext,
        sourceLanguage: batch.sourceLanguage,
        targetLanguages: batch.targetLanguages,
        contents: batch.contents.map((e) => ({
          key: e.key,
          source: e.source,
          notes: e.notes || [],
        })),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.status < 200 || response.status >= 400 || !response.body) {
      try {
        const body = await response.text();
        throw new Error(
          `Failed to translate: ${response.status}, body: ${body}`,
        );
      } catch (error) {
        throw new Error(
          `Failed to translate: ${response.status}, error: ${error}`,
        );
      }
    }
    const expectedChunkTokenCount =
      batch.expectedTokens * (1 + translatorConfig.buffer);
    let receivedChunkTokenCount = 0;
    const TranslationReponseSchema = z.record(
      z.string(),
      z.record(
        z.enum([batch.targetLanguages[0], ...batch.targetLanguages.slice(1)]),
        z.string(),
      ),
    );
    let translationResponse:
      | z.infer<typeof TranslationReponseSchema>
      | undefined;
    let latestObjectChunk: string | undefined; // for error logging only
    try {
      for await (const chunk of response.body) {
        const objectChunks = chunk
          .toString()
          .split('\n')
          .filter((s) => s.trim().length > 0);
        for (const objectChunkString of objectChunks) {
          const object = JSON.parse(objectChunkString) as ObjectStreamPart<
            z.infer<typeof TranslationReponseSchema>
          >;
          if (object.type === 'error') {
            throw new Error(
              `Failed to translate: ${object.error}, error: ${object.error}, response object: ${objectChunkString}`,
            );
          } else if (object.type === 'finish') {
            this.usage = {
              promptTokens: this.usage.promptTokens + object.usage.promptTokens,
              completionTokens:
                this.usage.completionTokens + object.usage.completionTokens,
              totalTokens: this.usage.totalTokens + object.usage.totalTokens,
            };
          } else if (object.type === 'object') {
            latestObjectChunk = objectChunkString;
            const parseResult = await TranslationReponseSchema.safeParseAsync(
              object.object,
            );
            if (!parseResult.success) {
              // we didn't get expected object for now, wait for more chunks
              logger.warn(
                `Failed to parse object chunk: ${objectChunkString}, error: ${parseResult.error}`,
              );
              continue;
            } else {
              translationResponse = parseResult.data;
              receivedChunkTokenCount += calTokens(
                translatorConfig.tokenizer,
                translatorConfig.tokenizerModel,
                JSON.stringify(object.object),
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
          }
        }
      }
    } catch (err) {
      throw new Error(`Failed to load streaming api response: ${err}`);
    }
    if (!translationResponse) {
      throw new Error(
        `Failed to receive translation response object, latest object chunk: ${latestObjectChunk}`,
      );
    }
    return translationResponse;
  }
}
