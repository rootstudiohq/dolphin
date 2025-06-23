import { logger } from '@repo/base/logger';

import { DolphinJSON } from '../../storage/index.js';

export enum MergeBehavior {
  Noop = 'noop',
  CopySource = 'copy_source',
  WriteEmpty = 'write_empty',
}

export function getTargetValue({
  json,
  targetLanguage,
  key,
  behavior = MergeBehavior.Noop,
}: {
  json: DolphinJSON;
  targetLanguage: string;
  key: string;
  behavior?: MergeBehavior;
}) {
  const unit = json.strings[key];
  if (!unit) {
    throw new Error(
      `No unit for string (${key}), strings: ${JSON.stringify(json.strings)}`,
    );
  }
  const translated = unit.localizations[targetLanguage];
  const sourceString = unit.localizations[json.sourceLanguage];
  let defaultValueIfNoTranslation: string | undefined;
  if (behavior === MergeBehavior.Noop) {
    defaultValueIfNoTranslation = undefined;
  } else if (behavior === MergeBehavior.CopySource) {
    defaultValueIfNoTranslation = sourceString.value;
  } else if (behavior === MergeBehavior.WriteEmpty) {
    defaultValueIfNoTranslation = '';
  }
  if (!translated) {
    logger.warn(
      `No target language (${targetLanguage}) unit for string (${key}), source language (${json.sourceLanguage})`,
    );
    return defaultValueIfNoTranslation;
  }
  if (translated.skip === true) {
    logger.warn(
      `The string (${key}) is skipped for target language (${targetLanguage})`,
    );
    return defaultValueIfNoTranslation;
  }
  if (
    translated.state === 'undefined' ||
    translated.state === 'new' ||
    translated.state === 'rejected'
  ) {
    logger.warn(
      `The string (${key}) is not translated yet for target language (${targetLanguage})`,
    );
    return defaultValueIfNoTranslation;
  }
  if (translated.value === undefined || translated.value === null) {
    throw new Error(
      `No string (${key}) translation found for ${targetLanguage} in ${json.sourceLanguage}, but state is ${translated.state}`,
    );
  }
  return translated.value;
}
