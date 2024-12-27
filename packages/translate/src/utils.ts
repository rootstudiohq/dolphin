import { TranslationTokenizer } from '@repo/base/config';
import { logger } from '@repo/base/logger';
import {
  DolphinJSON,
  DolphinJSONLocalizationUnit,
  DolphinJSONStringUnit,
} from '@repo/ioloc/storage';
import { Tiktoken, TiktokenModel, encodingForModel } from 'js-tiktoken';

import { LocalizationEntity } from './entity.js';

const encodings: Record<string, Tiktoken> = {};

export function calTokens(
  tokenizer: TranslationTokenizer,
  model: string,
  content: string,
) {
  if (tokenizer === 'openai') {
    if (!encodings[model]) {
      encodings[model] = encodingForModel(model as TiktokenModel);
    }
    const enc = encodings[model];
    return enc.encode(content).length;
  } else {
    throw new Error(`Unknown translator tokenizer: ${tokenizer}`);
  }
}

export function calEntityExpectedTokens(
  tokenizer: TranslationTokenizer,
  model: string,
  entity: LocalizationEntity,
) {
  let content = `"${entity.key}" = "${entity.sourceText}"\n`;
  const sourceTokens = calTokens(tokenizer, model, content);
  return sourceTokens;
}

export function calEntitySourceTokens(
  tokenizer: TranslationTokenizer,
  model: string,
  entity: LocalizationEntity,
) {
  let content = '';
  for (const note of entity.allComments || []) {
    content += `// ${note}\n`;
  }
  content += `"${entity.key}" = "${entity.sourceText}"\n\n`;
  const sourceTokens = calTokens(tokenizer, model, content);
  return sourceTokens;
}

/**
 * Merge the new and previous json. New json will take precedence over previous json.
 *
 * New json will be updated in place.
 *
 * The process will update strings which were already translated in previous json.
 *
 * @param newJson - The new DolphinJSON.
 * @param previousJson - The previous DolphinJSON.
 */
export function mergeDolphinJsons({
  newJson,
  previousJson,
}: {
  newJson: DolphinJSON;
  previousJson: DolphinJSON;
}) {
  // we will start with sanity check, TODO: handle errors and prompt suggestions

  // check if version is the same, for now we only have (and support) version 1.0
  if (newJson.version !== '1.0' || previousJson.version !== '1.0') {
    throw new Error(
      `Mismatched version: ${newJson.version} and ${previousJson.version}`,
    );
  }
  // make sure fileId is the same
  if (newJson.fileId !== previousJson.fileId) {
    throw new Error(
      `File ID mismatch: ${newJson.fileId} and ${previousJson.fileId}`,
    );
  }
  // make sure sourceLanguage is the same
  if (newJson.sourceLanguage !== previousJson.sourceLanguage) {
    throw new Error(
      `Source language mismatch: ${newJson.sourceLanguage} and ${previousJson.sourceLanguage}`,
    );
  }
  // merge metadata, new metadata will take precedence over previous metadata
  if (previousJson.metadata || newJson.metadata) {
    newJson.metadata = {
      ...newJson.metadata,
      ...previousJson.metadata,
      createdAt:
        previousJson.metadata?.createdAt ||
        newJson.metadata?.createdAt ||
        new Date().toISOString(),
    };
  }
  // update new bundle strings
  // iterate over new strings and target languages
  for (const [key, newUnit] of Object.entries(newJson.strings)) {
    for (const [targetLanguage, newLocalizationUnit] of Object.entries(
      newUnit.localizations,
    )) {
      if (targetLanguage === newJson.sourceLanguage) {
        continue;
      }
      const newState = getState({
        sourceLanguage: newJson.sourceLanguage,
        targetLanguage: targetLanguage,
        newUnit,
        previousUnit: previousJson.strings[key],
      });
      newLocalizationUnit.state = newState;
      newLocalizationUnit.skip =
        previousJson.strings[key]?.localizations[targetLanguage]?.skip;
      // merge metadata, new metadata will take precedence over previous metadata
      if (
        previousJson.strings[key]?.localizations[targetLanguage]?.metadata ||
        newLocalizationUnit.metadata
      ) {
        newLocalizationUnit.metadata = {
          ...previousJson.strings[key]?.localizations[targetLanguage]?.metadata,
          ...newLocalizationUnit.metadata,
        };
      }
    }
  }
}

function getState({
  sourceLanguage,
  targetLanguage,
  newUnit,
  previousUnit,
}: {
  sourceLanguage: string;
  targetLanguage: string;
  newUnit: DolphinJSONStringUnit;
  previousUnit?: DolphinJSONStringUnit;
}) {
  if (sourceLanguage === targetLanguage) {
    throw new Error(
      `Source language and target language are the same: ${sourceLanguage}`,
    );
  }
  const newSourceUnit = newUnit.localizations[sourceLanguage];
  const newTargetUnit = newUnit.localizations[targetLanguage];
  if (!newSourceUnit || !newTargetUnit) {
    throw new Error(
      `New source or target unit is missing: ${sourceLanguage} or ${targetLanguage}`,
    );
  }
  const previousSourceUnit = previousUnit?.localizations[sourceLanguage];
  const previousTargetUnit = previousUnit?.localizations[targetLanguage];
  if (!previousSourceUnit || !previousTargetUnit) {
    if (newTargetUnit.state === 'undefined') {
      if (newSourceUnit.value === newTargetUnit.value) {
        return 'new';
      } else {
        // consider translated for initial state
        return 'translated';
      }
    }
    return newTargetUnit.state;
  } else {
    // check if source or comments are different
    const newEntity = new LocalizationEntity({
      key: 'dummy',
      sourceLanguage,
      unit: newUnit,
    });
    const previousEntity = new LocalizationEntity({
      key: 'dummy',
      sourceLanguage,
      unit: previousUnit,
    });
    const isSourceDifferent =
      newSourceUnit.value !== previousSourceUnit.value ||
      new Set(newEntity.allComments) !== new Set(previousEntity.allComments);
    if (isSourceDifferent) {
      // if source changes, we consider it as new
      if (newTargetUnit.state === 'undefined') {
        return 'new';
      }
      return newTargetUnit.state;
    }
    const isTargetDifferent = newTargetUnit.value !== previousTargetUnit.value;
    if (isTargetDifferent) {
      // if target changes, we consider it as translated (likely modified manually)
      return 'translated';
    } else {
      // target is the same, inherit previous state
      return previousTargetUnit.state;
    }
  }
}
