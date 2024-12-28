import { Config, LLMTranslatorConfig } from '@repo/base/config';
import { logger } from '@repo/base/logger';

import { TranslationBatch, createBatches } from '../batch.js';
import { LocalizationEntity } from '../entity.js';

export type TranslationBatchFunc = ({
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
}) => Promise<Record<string, Record<string, string>>>;

export type TranslationConfigFunc = () => Promise<LLMTranslatorConfig>;

export async function translateEntities({
  agent,
  entities,
  config,
  maxRetry,
  translationConfig,
  translationBatch,
  onProgress,
}: {
  agent: 'api' | 'openai';
  entities: LocalizationEntity[];
  config: Config;
  maxRetry: number;
  translationConfig: TranslationConfigFunc;
  translationBatch: TranslationBatchFunc;
  onProgress?: (progress: number) => void;
}): Promise<LocalizationEntity[]> {
  if (entities.length === 0) {
    logger.info(`No entity to translate`);
    return [];
  }

  const translatorConfig = await translationConfig();

  const batches = createBatches(entities, {
    maxTokens: translatorConfig.maxOutputTokens,
    buffer: translatorConfig.buffer,
    tokenizer: translatorConfig.tokenizer,
    tokenizerModel: translatorConfig.tokenizerModel,
  });

  let totalCount = batches.reduce(
    (total, batch) =>
      total + batch.contents.length * batch.targetLanguages.length,
    0,
  );
  let translatedCount = 0;
  const maxPercentage = 0.92 + Math.random() * 0.08;

  logger.info(`Translating ${batches.length} batches with ${agent}...`);
  let failedBatches: TranslationBatch[] = [];
  for (let [batchIndex, batch] of batches.entries()) {
    logger.info(
      `Translating batch<${batchIndex}>: ${
        batch.sourceLanguage
      } -> ${batch.targetLanguages.join(', ')}`,
    );
    const firstTargetLanguage = batch.targetLanguages[0];
    if (!firstTargetLanguage) {
      continue;
    }
    let currentRetry = 1;
    let translatedContents: Record<string, Record<string, string>> = {};
    let latestError: Error | undefined;
    while (currentRetry <= maxRetry) {
      try {
        translatedContents = await translationBatch({
          batch,
          config,
          translatorConfig,
          translatedCount,
          totalCount,
          maxPercentage,
          onProgress,
        });
        break;
      } catch (error) {
        logger.error(
          `Failed to translate, retrying ${currentRetry}/${maxRetry}, error: ${error}`,
        );
        latestError = error as Error;
      }
      currentRetry += 1;
    }
    if (currentRetry > maxRetry) {
      logger.error(
        `Failed to translate batch<${batchIndex}> after ${
          maxRetry
        } retries. Latest error: ${JSON.stringify(
          latestError,
        )}. Skip to next batch. Please view the logs for more details.`,
      );
      failedBatches.push(batch);
      continue;
    }
    for (const key in translatedContents) {
      const translated = translatedContents[key]!;
      for (const entity of entities) {
        if (entity.key === key) {
          for (const lang in translated) {
            entity.unit.localizations[lang] = {
              ...entity.unit.localizations[lang],
              value: translated[lang]!,
              state: 'translated',
            };
          }
        }
      }
    }
    translatedCount += batch.targetLanguages.length * batch.contents.length;

    if (onProgress) {
      onProgress(translatedCount / totalCount);
    }
  }

  if (failedBatches.length > 0) {
    logger.warn(`Failed to translate ${failedBatches.length} batches`);
    for (const batch of failedBatches) {
      logger.warn(
        `Failed batch: ${batch.sourceLanguage} -> ${batch.targetLanguages.join(
          ', ',
        )}`,
      );
    }
  }
  return entities;
}
