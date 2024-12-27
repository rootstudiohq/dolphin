import { logger } from '@repo/base/logger';
import path from 'node:path';

import { ImportLocalizations } from '../index.js';
import { XcodeImportLocalizations } from '../xcode.js';
import { BasicImporter, ImportLanguageConfig } from './basic.js';
import { ImportConfig, XliffMerger } from './index.js';

export class XclocImporter extends BasicImporter<XliffMerger> {
  constructor({ config }: { config: ImportConfig }) {
    super({
      config,
      merger: new XliffMerger(),
      sourceFilePathFn: async (config) => {
        return await this.xlocSourceFileContentFn(config);
      },
      targetFilePathFn: async (config, language) => {
        return await this.xlocTargetFilePathFn(config, language);
      },
    });
  }

  private async xlocSourceFileContentFn(config: ImportConfig) {
    return path.join(
      config.sourceLanguage.path,
      `Localized Contents/${config.sourceLanguage.code}.xliff`,
    );
  }

  private async xlocTargetFilePathFn(
    config: ImportLanguageConfig,
    language: string,
  ) {
    return path.join(config.path, `Localized Contents/${language}.xliff`);
  }
}

export class XcodeImporter implements ImportLocalizations {
  private config: ImportConfig;
  private projectPath: string;
  private intermediateBundlePath: string;

  constructor({
    config,
    intermediateBundlePath,
    projectPath,
  }: {
    config: ImportConfig;
    intermediateBundlePath: string;
    projectPath: string;
  }) {
    this.config = config;
    this.intermediateBundlePath = intermediateBundlePath;
    this.projectPath = projectPath;
  }

  async import(): Promise<void> {
    // Step 1: Use XclocImporter to localize strings to intermediateBundlePath
    const xclocImporter = new XclocImporter({
      config: {
        ...this.config,
        sourceLanguage: {
          code: this.config.sourceLanguage.code,
          path: path.join(
            this.intermediateBundlePath,
            `${this.config.sourceLanguage.code}.xcloc`,
          ),
        },
        targetLanguages: this.config.targetLanguages.map((lang) => ({
          ...lang,
          to: path.join(this.intermediateBundlePath, `${lang.code}.xcloc`),
        })),
      },
    });

    await xclocImporter.import();

    // Step 2: Use XcodeImportLocalizations to import intermediateBundlePath to Xcode project
    const xcodeImporter = new XcodeImportLocalizations();
    const xcodeImportResult = await xcodeImporter.import({
      localizationBundlePath: this.intermediateBundlePath,
      projectPath: this.projectPath,
      baseFolder: this.config.baseFolder,
    });

    if (xcodeImportResult.code !== 0) {
      throw new Error(
        `Xcode import failed with code ${xcodeImportResult.code}`,
      );
    }

    logger.info('Xcode import completed');
  }
}
