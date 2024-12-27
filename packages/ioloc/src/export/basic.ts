import { logger } from '@repo/base/logger';
import fs from 'node:fs';
import path from 'node:path';

import { ExportLocalizations, ExportLocalizationsResult } from '../index.js';
import { DolphinJSON } from '../storage/index.js';

export interface ExportParser {
  exportSource(options: {
    fileId: string; // The file ID specified in the config file
    content: string;
    language: string;
  }): Promise<DolphinJSON>; // export the json data for source language
  exportTarget(options: {
    fileId: string; // The file ID specified in the config file
    content?: string;
    language: string;
    json: DolphinJSON;
  }): Promise<DolphinJSON>; // export and merge the target language to the source data
}

export interface ExportLanguageConfig {
  code: string;
  path: string;
}

export interface ExportConfig {
  id: string;
  sourceLanguage: ExportLanguageConfig;
  targetLanguages: ExportLanguageConfig[];
  baseFolder: string;
}

/**
 * General exporter using parser to export localizations, which works for most of the cases
 * For example, texts, strings, xliff, json, etc.
 */
export class BasicExporter<P extends ExportParser>
  implements ExportLocalizations
{
  private config: ExportConfig;
  private parser: P;
  private sourceFileContentFn: (config: ExportConfig) => Promise<string>;
  private targetFileContentFn: (
    config: ExportLanguageConfig,
    language: string,
  ) => Promise<string>;

  constructor({
    config,
    parser,
    sourceFileContentFn,
    targetFileContentFn,
  }: {
    config: ExportConfig;
    parser: P;
    sourceFileContentFn?: (config: ExportConfig) => Promise<string>;
    targetFileContentFn?: (
      config: ExportLanguageConfig,
      language: string,
    ) => Promise<string>;
  }) {
    this.config = config;
    this.parser = parser;
    this.sourceFileContentFn =
      sourceFileContentFn || this.defaultSourceFileContentFn;
    this.targetFileContentFn =
      targetFileContentFn || this.defaultTargetFileContentFn;
  }

  async export(): Promise<ExportLocalizationsResult> {
    const sourceText = await this.sourceFileContentFn(this.config);
    // Genrate source language json
    let json = await this.parser.exportSource({
      fileId: this.config.id,
      content: sourceText,
      language: this.config.sourceLanguage.code,
    });
    logger.info(
      `[BasicExporter: ${this.config.id}]: Source localization exported successfully, strings count: ${Object.keys(json.strings).length}`,
    );
    // Merge target language json
    for (const langConfig of this.config.targetLanguages) {
      const language = langConfig.code;
      logger.info(
        `[BasicExporter: ${this.config.id}]: Exporting target localization<${language}> from ${langConfig.path}`,
      );
      const targetText = await this.targetFileContentFn(langConfig, language);
      json = await this.parser.exportTarget({
        fileId: this.config.id,
        content: targetText,
        language: language,
        json: json,
      });
      logger.info(
        `[BasicExporter: ${this.config.id}]: Target localization<${language}> exported successfully`,
      );
    }
    return {
      json: json,
      meta: {},
    };
  }

  private async defaultSourceFileContentFn(config: ExportConfig) {
    const sourcePath = config.sourceLanguage.path;
    if (!path.isAbsolute(sourcePath)) {
      throw new Error(
        `[BasicExporter: ${config.id}]: Source path should be an absolute path: ${sourcePath}`,
      );
    }
    return await fs.promises.readFile(sourcePath, 'utf8');
  }

  private async defaultTargetFileContentFn(
    config: ExportLanguageConfig,
    language: string,
  ) {
    const targetPath = config.path;
    if (!path.isAbsolute(targetPath)) {
      throw new Error(
        `[BasicExporter]: Target path should be an absolute path: ${targetPath}`,
      );
    }
    return await fs.promises.readFile(targetPath, 'utf8');
  }
}
