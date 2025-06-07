import { TranslationTokenizer } from '@repo/base/config';
import { logger } from '@repo/base/logger';

import { LocalizationEntity } from './entity.js';
import { calEntityExpectedTokens, calEntitySourceTokens } from './utils.js';

export type TranslationBatch = {
  sourceLanguage: string;
  targetLanguages: string[];
  contents: {
    key: string;
    source: string;
    notes?: string[];
  }[];
  sourceTokens: number;
  expectedTokens: number;
};

/**
 * Create batches of translations for a given set of entities to avoid token limits.
 *
 * @param entities - The set of entities to be translated.
 * @param config - The configuration for the translation process.
 * @returns An array of translation batches.
 */
export function createBatches(
  entities: LocalizationEntity[],
  config: {
    maxTokens: number;
    buffer: number;
    tokenizer: TranslationTokenizer;
    tokenizerModel: string;
  },
): TranslationBatch[] {
  if (entities.length === 0) {
    return [];
  }
  let batches: TranslationBatch[] = [];
  const remainings: Set<LocalizationEntity> = new Set(entities);
  const maxSafeTokens = Math.floor(config.maxTokens * (1 - config.buffer));

  while (remainings.size > 0) {
    const entity = remainings.values().next().value;
    if (!entity) {
      break;
    }
    remainings.delete(entity);
    const targetLanguages = entity.untranslatedLanguages;
    if (targetLanguages.length === 0) {
      logger.info(
        `Skipping ${entity.key} because all target languages are translated.`,
      );
      continue;
    }

    const expectedTokens = calEntityExpectedTokens(
      config.tokenizer,
      config.tokenizerModel,
      entity,
    );
    if (expectedTokens > maxSafeTokens) {
      throw new Error(
        `${entity.key} is too long to be translated: ${entity.sourceText.slice(
          0,
          20,
        )}...}`,
      );
    }

    if (expectedTokens * targetLanguages.length > maxSafeTokens) {
      logger.info(
        `Splitting ${entity.key} because it is too long to be translated`,
      );
      const maxLanguagesPerBatch = Math.floor(maxSafeTokens / expectedTokens);
      const groupCount = Math.ceil(
        targetLanguages.length / maxLanguagesPerBatch,
      );
      for (let i = 0; i < groupCount; i++) {
        const group = targetLanguages.slice(
          i * maxLanguagesPerBatch,
          (i + 1) * maxLanguagesPerBatch,
        );
        batches.push({
          sourceLanguage: entity.sourceLanguage,
          targetLanguages: group,
          contents: [
            {
              key: entity.key,
              source: entity.sourceText,
              notes: entity.allComments,
            },
          ],
          sourceTokens: calEntitySourceTokens(
            config.tokenizer,
            config.tokenizerModel,
            entity,
          ),
          expectedTokens: expectedTokens * group.length,
        });
      }
    } else {
      let currentExpectedTokens = expectedTokens;
      let currentSourceTokens = calEntitySourceTokens(
        config.tokenizer,
        config.tokenizerModel,
        entity,
      );
      let similarEntities = [entity];
      for (let remainingEntity of remainings) {
        const remainingTargetLanguages = remainingEntity.untranslatedLanguages;
        if (
          remainingEntity.sourceLanguage === entity.sourceLanguage &&
          remainingTargetLanguages.join(', ') === targetLanguages.join(', ')
        ) {
          const expectedTokens =
            calEntityExpectedTokens(
              config.tokenizer,
              config.tokenizerModel,
              remainingEntity,
            ) * remainingTargetLanguages.length;
          if (currentExpectedTokens + expectedTokens > maxSafeTokens) {
            break;
          } else {
            similarEntities.push(remainingEntity);
            remainings.delete(remainingEntity);
            currentExpectedTokens += expectedTokens;
            currentSourceTokens += calEntitySourceTokens(
              config.tokenizer,
              config.tokenizerModel,
              remainingEntity,
            );
          }
        }
      }
      batches.push({
        sourceLanguage: entity.sourceLanguage,
        targetLanguages: targetLanguages,
        contents: similarEntities.map((e) => ({
          key: e.key,
          source: e.sourceText,
          notes: e.allComments,
        })),
        sourceTokens: currentSourceTokens,
        expectedTokens: currentExpectedTokens,
      });
    }
  }
  return batches;
}
