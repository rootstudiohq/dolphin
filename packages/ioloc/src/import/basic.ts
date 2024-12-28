import { logger } from '@repo/base/logger';
import path from 'node:path';

import { ImportLocalizations } from '../index.js';
import { DolphinJSON } from '../storage/index.js';

export type ImportLanguageConfig = {
  code: string;
  path: string; // language file path
};

export interface ImportConfig {
  id: string;
  json: DolphinJSON;
  sourceLanguage: ImportLanguageConfig;
  targetLanguages: ImportLanguageConfig[];
  baseFolder: string;
}

export interface ImportMerger {
  merge(options: {
    json: DolphinJSON;
    sourceFilePath: string;
    targetLanguage: string;
    targetFilePath: string;
  }): Promise<void>;
}

export class BasicImporter<T extends ImportMerger>
  implements ImportLocalizations
{
  private config: ImportConfig;
  private merger: T;
  private sourceFilePathFn: (config: ImportConfig) => Promise<string>;
  private targetFilePathFn: (
    config: ImportLanguageConfig,
    language: string,
  ) => Promise<string>;

  constructor({
    config,
    merger,
    sourceFilePathFn,
    targetFilePathFn,
  }: {
    config: ImportConfig;
    merger: T;
    sourceFilePathFn?: (config: ImportConfig) => Promise<string>;
    targetFilePathFn?: (
      config: ImportLanguageConfig,
      language: string,
    ) => Promise<string>;
  }) {
    this.config = config;
    this.merger = merger;
    this.sourceFilePathFn = sourceFilePathFn || this.defaultSourceFilePathFn;
    this.targetFilePathFn = targetFilePathFn || this.defaultTargetFilePathFn;
  }

  async import(): Promise<void> {
    const sourceFilePath = await this.sourceFilePathFn(this.config);
    if (!path.isAbsolute(sourceFilePath)) {
      throw new Error(
        `[BasicImporter: ${this.config.id}]: Source path should be an absolute path: ${sourceFilePath}`,
      );
    }
    for (const targetLanguage of this.config.targetLanguages) {
      logger.info(
        `[BasicImporter: ${this.config.id}]: Importing target localization<${targetLanguage.code}, ${targetLanguage.path}>...`,
      );
      await this.merger.merge({
        json: this.config.json,
        sourceFilePath,
        targetLanguage: targetLanguage.code,
        targetFilePath: await this.targetFilePathFn(
          targetLanguage,
          targetLanguage.code,
        ),
      });
      logger.info(
        `[BasicImporter: ${this.config.id}]: Target localization<${targetLanguage.code}, ${targetLanguage.path}> imported successfully`,
      );
    }
  }

  private async defaultSourceFilePathFn(config: ImportConfig) {
    return config.sourceLanguage.path;
  }

  private async defaultTargetFilePathFn(
    config: ImportLanguageConfig,
    language: string,
  ) {
    return config.path;
  }
}
