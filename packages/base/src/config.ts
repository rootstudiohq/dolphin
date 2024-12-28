import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';

import { logger } from './logger.js';
import { absoluteFilePath } from './utils.js';

export enum LocalizationFormat {
  TEXT = 'text', // Plain text file
  XCODE = 'xcode', // Xcode project
  XCLOC = 'xcloc', // Xcloc file
  STRINGS = 'strings', // Apple strings files (.strings)
  XCSTRINGS = 'xcstrings', // Apple strings catalog
  XLIFF = 'xliff', // XLIFF file
  JSON = 'json', // JSON file
}

const LocalizationFormatZodEnum = z.nativeEnum(LocalizationFormat);

const CommonLocalizationConfigSchema = z.object({
  id: z.string(),
  path: z.string(),
  format: LocalizationFormatZodEnum,
});

export type CommonLocalizationConfig = z.infer<
  typeof CommonLocalizationConfigSchema
>;

const TextLocalizationConfigSchema = z.object({
  id: z.string(),
  path: z.string(),
  format: LocalizationFormatZodEnum,
  languages: z.array(z.string()),
});

export type TextLocalizationConfig = z.infer<
  typeof TextLocalizationConfigSchema
>;

const LocalizationConfigSchema = z.union([
  TextLocalizationConfigSchema,
  CommonLocalizationConfigSchema,
]);

export type LocalizationConfig = z.infer<typeof LocalizationConfigSchema>;

const CommonTranslatorConfigSchema = z.object({
  mode: z.enum(['automatic', 'interactive']).default('automatic'),
});

export const LLMTranslatorConfigSchema = z.object({
  maxOutputTokens: z.number().default(4096),
  buffer: z.number().default(0.3),
  maxRetry: z.number().default(1),
  tokenizer: z.enum(['openai']).default('openai'),
  tokenizerModel: z.string().default('gpt-4'), // use for tiktoken cal
});

const TranslationTokenizerEnum = z.enum(['openai']);

export type TranslationTokenizer = z.infer<typeof TranslationTokenizerEnum>;

export type LLMTranslatorConfig = z.infer<typeof LLMTranslatorConfigSchema>;

const DolphinTranslatorConfigSchema = CommonTranslatorConfigSchema.extend({
  agent: z.literal('api'),
  baseUrl: z.string(),
});

const OpenAITranslatorConfigSchema = CommonTranslatorConfigSchema.extend({
  agent: z.literal('openai'),
  apiKey: z.string().optional(),
}).merge(LLMTranslatorConfigSchema);

const TranslatorConfigSchema = z.union([
  DolphinTranslatorConfigSchema,
  OpenAITranslatorConfigSchema,
]);

export type TranslatorConfig = z.infer<typeof TranslatorConfigSchema>;

const BaseConfigSchema = z.object({
  path: z.string(), // path to the config file, auto populated

  translator: TranslatorConfigSchema,
  baseLanguage: z.string(),
  exportFolder: z.string().optional(), // by default, it's .dolphin in the same folder as the config file
  globalContext: z.string().optional(),
  localizations: z.array(LocalizationConfigSchema),
});

export type Config = z.infer<typeof BaseConfigSchema>;

export async function parseConfigText({
  yamlText,
  configPath,
}: {
  yamlText: string;
  configPath: string;
}): Promise<Config> {
  const yaml = YAML.parse(yamlText);
  yaml.path = configPath;
  const result = await BaseConfigSchema.safeParseAsync(yaml);
  if (!result.success) {
    const validationError = fromZodError(result.error);
    throw new Error(`Invalid config file: ${validationError}`);
  } else {
    const config = result.data;
    // exclude base language from languages array
    const baseLanguage = config.baseLanguage;
    config.localizations = config.localizations.map((localization) => {
      // if has languages, exclude base language
      if ('languages' in localization) {
        localization.languages = localization.languages.filter(
          (language) => language !== baseLanguage,
        );
      }
      return localization;
    });
    await validateConfig(config);
    return config;
  }
}

export async function parseConfig(userConfigPath?: string): Promise<Config> {
  let configPath = userConfigPath;
  if (!configPath) {
    throw new Error(
      `Missing config file. You can either set using --config or put dolphin.y[a]ml under the root path of the project.`,
    );
  }
  configPath = absoluteFilePath(configPath, process.cwd());
  // Check if configPath is a directory
  const stats = await fs.promises.stat(configPath);
  if (stats.isDirectory()) {
    logger.info(
      `No yaml config file provided. Searching config file (dolphin.y[a]ml) under the directory(${configPath})...`,
    );
    const searchFiles = ['dolphin.yml', 'dolphin.yaml'];
    let found = false;
    for (const file of searchFiles) {
      const attemptConfigPath = path.join(configPath, file);
      try {
        await fs.promises.access(attemptConfigPath);
        configPath = attemptConfigPath;
        found = true;
        break;
      } catch (error) {
        continue;
      }
    }
    if (!found) {
      throw new Error(
        `No dolphin.y[a]ml found in the specified directory: ${configPath}`,
      );
    }
  }

  logger.info(`Using config file at ${configPath}`);
  let fileContent;
  try {
    fileContent = await fs.promises.readFile(configPath, 'utf-8');
  } catch (error) {
    throw new Error(
      `Cannot read config file at ${configPath}, error: ${error}`,
    );
  }
  return parseConfigText({ yamlText: fileContent, configPath });
}

async function validateConfig(config: Config) {
  // check if localizations has duplicate ids
  const localizationIds = new Set<string>();
  for (const localization of config.localizations) {
    if (localizationIds.has(localization.id)) {
      throw new Error(
        `Duplicate localization id (${localization.id}) found. Please make sure each localization has a unique id.`,
      );
    }
    localizationIds.add(localization.id);
  }
}
