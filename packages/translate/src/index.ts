import input from '@inquirer/input';
import select from '@inquirer/select';
import { Config } from '@repo/base/config';
import { logger } from '@repo/base/logger';
import { Spinner } from '@repo/base/spinner';
import { writeFile } from '@repo/base/utils';
import {
  DOLPHIN_JSON_FILE_NAME,
  DolphinJSON,
  readDolphinJSON,
} from '@repo/ioloc/storage';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';

import { LocalizationEntity, LocalizationEntityDictionary } from './entity.js';
import { DolphinAPITranslator } from './translator/dolphin/index.js';
import { Translator } from './translator/index.js';
import { OpenAITranslator } from './translator/openai/index.js';
import { mergeDolphinJsons } from './utils.js';

export enum TranslationMode {
  AUTOMATIC = 'automatic', // No user interaction needed. The program will find the most suitable translation for each string.
  INTERACTIVE = 'interactive', // Ask user for confirmation for each string translation.
}

/**
 * Translate all dolphin.json files in a bundle in place.
 *
 * Example bundle structure:
 * - bundlePath
 * | - id1
 * |   | - dolphin.json
 * | - id2
 *     | - dolphin.json
 */
export async function translateBundle(
  bundlePath: string,
  config: Config,
  spinner?: Spinner,
): Promise<void> {
  const subfolders = await fs.promises.readdir(bundlePath, {
    withFileTypes: true,
  });
  const subfolderNames = subfolders
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);
  let jsonFilePaths: string[] = [];
  for (const subfolderName of subfolderNames) {
    const subfolder = path.join(bundlePath, subfolderName);
    const files = await fs.promises.readdir(subfolder, {
      withFileTypes: true,
    });
    const jsonFileNames = files
      .filter((dirent) => dirent.isFile() && dirent.name === 'dolphin.json')
      .map((dirent) => dirent.name);
    if (jsonFileNames.length === 0) {
      logger.warn(`No dolphin.json found in ${subfolder}`);
      continue;
    }
    jsonFilePaths.push(
      ...jsonFileNames.map((fileName) => path.join(subfolder, fileName)),
    );
  }
  for (const jsonFilePath of jsonFilePaths) {
    logger.info(`[${jsonFilePath}] Translating...`);
    const json = await readDolphinJSON(jsonFilePath);
    const res = await translateDolphinJson({
      json,
      config,
      spinner,
    });
    if (!res) {
      logger.info(`[${jsonFilePath}] No strings found, skipping translation`);
      continue;
    }
    const newJson = res.json;
    // update lastTranslatedAt metadata
    if (!newJson.metadata) {
      newJson.metadata = {};
    }
    newJson.metadata.lastTranslatedAt = new Date().toISOString();
    mergeDolphinJsons({ newJson, previousJson: json });
    logger.info(
      `[${jsonFilePath}] Saving translated dolphin.json: ${JSON.stringify(newJson, null, 2)}`,
    );
    await writeFile(jsonFilePath, JSON.stringify(newJson, null, 2));
  }
}

export async function mergeBundles({
  newBundleFolder,
  previousBundleFolder,
}: {
  newBundleFolder: string;
  previousBundleFolder: string;
}) {
  if (!fs.existsSync(previousBundleFolder)) {
    logger.info(
      `No previous bundle found at ${previousBundleFolder}. No need to merge.`,
    );
    return;
  }

  const dolphinJsonFilePath = path.join(
    newBundleFolder,
    DOLPHIN_JSON_FILE_NAME,
  );
  const previousDolphinJsonFilePath = path.join(
    previousBundleFolder,
    DOLPHIN_JSON_FILE_NAME,
  );

  if (!fs.existsSync(previousDolphinJsonFilePath)) {
    logger.info(
      `No previous dolphin.json file found at ${previousDolphinJsonFilePath}. Skip merging.`,
    );
    return;
  }

  const newJson = await readDolphinJSON(dolphinJsonFilePath);
  const previousJson = await readDolphinJSON(previousDolphinJsonFilePath);

  // Merge the files
  mergeDolphinJsons({ newJson, previousJson });

  // Write back the merged content
  await writeFile(dolphinJsonFilePath, JSON.stringify(newJson, null, 2));
}

async function translateDolphinJson({
  json,
  config,
  spinner,
}: {
  json: DolphinJSON;
  config: Config;
  spinner?: Spinner;
}): Promise<{
  json: DolphinJSON;
  additionalInfo: any;
} | null> {
  logger.info(`[${json.fileId}] Translating dolphin.json...`);
  let untranslatedMergedStrings: LocalizationEntityDictionary = {};
  // deep clone json
  const newJson: DolphinJSON = JSON.parse(JSON.stringify(json));
  for (const [key, value] of Object.entries(newJson.strings)) {
    const entity = new LocalizationEntity({
      key,
      sourceLanguage: newJson.sourceLanguage,
      unit: value,
    });
    if (entity.untranslatedLanguages.length > 0) {
      untranslatedMergedStrings[key] = entity;
    }
  }
  const count = Object.keys(untranslatedMergedStrings).length;
  logger.info(`[${newJson.fileId}] ${count} strings to be translated`);
  spinner?.succeed(
    chalk.green(
      `[${newJson.fileId}] ${count} strings to be translated, total: ${
        Object.keys(newJson.strings).length
      }\n`,
    ),
  );
  if (count === 0) {
    logger.info(`[${newJson.fileId}] No strings found, skipping translation`);
    return null;
  }
  logger.info(
    `[${newJson.fileId}] Strings to be translated: ${JSON.stringify(
      untranslatedMergedStrings,
    )}`,
  );
  const res = await translateStrings(
    untranslatedMergedStrings,
    config,
    spinner,
  );
  // create new json with translated strings
  // deep clone json
  for (const [key, entity] of Object.entries(res.mergedStrings)) {
    logger.info(`[${key}] Updating unit: ${JSON.stringify(entity.unit)}`);
    newJson.strings[key] = entity.unit;
  }
  return {
    json: newJson,
    additionalInfo: res.additionalInfo,
  };
}

async function translateStrings(
  mergedStrings: LocalizationEntityDictionary,
  config: Config,
  spinner?: Spinner,
  // mode: TranslationMode,
  // sourceLanguage?: string
): Promise<{
  mergedStrings: LocalizationEntityDictionary;
  additionalInfo: any;
}> {
  logger.info(`Localizer config: ${JSON.stringify(config)}`);
  let translator: Translator;
  const agent = config.translator.agent;
  if (agent === 'api') {
    translator = new DolphinAPITranslator(config.translator.baseUrl);
  } else if (agent === 'openai') {
    const apiKey = config.translator.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    translator = new OpenAITranslator(apiKey);
  } else {
    throw new Error(`The translator agent: ${agent} is not supported`);
  }

  var remainings = Object.values(mergedStrings);
  var reviewed: LocalizationEntity[] = [];
  while (remainings.length > 0) {
    const total = remainings.length;
    logger.info(`Translating ${total} strings with ${agent}...`);
    spinner?.update(`[0%] Translating with ${agent}...`, {
      logging: false,
    });
    const translations = await translator.translate(
      remainings,
      config,
      (progress) => {
        spinner?.update(
          `[${(progress * 100).toFixed(2)}%] Translating with ${agent}...`,
          {
            logging: false,
          },
        );
      },
    );
    const untranslated = translations.filter(
      (e) => e.untranslatedLanguages.length > 0,
    );
    logger.info(`Translated ${translations.length} strings`);
    remainings = [];

    if (spinner) {
      let message = chalk.green('Translation finished ');
      if (untranslated.length > 0) {
        message += chalk.yellow(
          `(⚠️ ${untranslated.length}/${translations.length} strings were not translated)`,
        );
      } else {
        message += chalk.green(`(${translations.length} strings)`);
      }
      spinner.succeed(`${message}\n`);
    }

    if (config.translator.mode === TranslationMode.INTERACTIVE) {
      var approved = 0;
      var declined = 0;
      var refineNeeded = 0;
      for (let index = 0; index < translations.length; index++) {
        const entity = translations[index];
        if (!entity.needsReview) {
          logger.info(
            `Skip reviewing ${entity.key} because all target languages are final.`,
          );
          continue;
        }
        if (!entity.isAllTranslated) {
          logger.info(
            `Skip reviewing ${entity.key} because not all target languages are translated.`,
          );
          continue;
        }
        var message = `[${
          reviewed.length + 1
        }/${total}] [Interactive Mode] Reviewing translation:\n`;
        if (config.globalContext) {
          message += `[Context]:\n${config.globalContext}\n\n`;
        }
        message += `${chalk.yellow(`${entity.sourceText} (Source)`)}\n${
          entity.sourceText
        }\n`;
        const allComments = entity.allComments;
        if (allComments.length > 0) {
          message += `Notes:\n`;
          for (const comment of allComments) {
            message += `• ${comment}\n`;
          }
          message += `\n`;
        }
        for (const lang of entity.targetLanguages) {
          const target = entity.unit.localizations[lang]!;
          if (target.state === 'new') {
            message += `${chalk.green(lang)} [Skipped]\n${target.value}\n`;
          } else {
            message += `${chalk.red(lang)}\n${target.value}\n`;
          }
        }
        const reviewResult = await select(
          {
            message: message,
            choices: [
              {
                name: 'Approve',
                value: 'approved',
                description: 'Approve the translation',
              },
              {
                name: 'Retry with Suggestions',
                value: 'refineNeeded',
                description:
                  'Type in suggestions and it will be translated again afterwards',
              },
              {
                name: 'Decline',
                value: 'declined',
                description: 'The translation will be discarded',
              },
              {
                name: 'Approve All',
                value: 'approveAll',
                description: 'Skip reviewing all translations for this string',
              },
            ],
          },
          {
            clearPromptOnDone: true,
          },
        );
        if (reviewResult === 'approved') {
          entity.updateState('reviewed', 'approved');
          reviewed.push(entity);
          approved += 1;
        } else if (reviewResult === 'declined') {
          entity.updateState('new', 'declined');
          reviewed.push(entity);
          declined += 1;
        } else if (reviewResult === 'refineNeeded') {
          // ask for suggestions
          spinner?.stop({ persist: true });
          const auditSuggestion = await input(
            {
              message:
                'Enter suggestion to help the translator refine the translation:',
            },
            {
              clearPromptOnDone: true,
            },
          );
          entity.updateState('new', 'refineNeeded');
          entity.addAdditionalComments([auditSuggestion]);
          remainings.push(entity);
          refineNeeded += 1;
        } else if (reviewResult === 'approveAll') {
          reviewed.push(...translations.slice(index));
          approved += translations.length - index;
          break;
        }
      }

      if (spinner) {
        spinner.succeed(
          chalk.green(
            `Review done: ${approved} approved, ${declined} declined, ${refineNeeded} refine needed.\n`,
          ),
        );
      }
    } else {
      reviewed.push(...translations);
    }

    for (const entity of reviewed) {
      if (entity.isFinal) {
        mergedStrings[entity.key] = entity;
      }
    }
  }

  logger.info(`Translated file: ${JSON.stringify(mergedStrings)}`);
  const additionalInfo = translator.additionalInfo();
  logger.info(`Additional info: ${JSON.stringify(additionalInfo)}`);
  return {
    mergedStrings,
    additionalInfo,
  };
}
