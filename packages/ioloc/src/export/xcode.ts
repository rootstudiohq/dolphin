import { logger } from '@repo/base/logger';
import { absoluteFilePath } from '@repo/base/utils';
import fs from 'node:fs';
import path from 'node:path';

import { ExportLocalizations, ExportLocalizationsResult } from '../index.js';
import { createTemporaryOutputFolder } from '../utils.js';
import { XcodeExportLocalizations } from '../xcode.js';
import { ExportConfig, ExportLanguageConfig } from './index.js';
import { BasicExporter } from './index.js';
import { XliffParser } from './parser/xliff.js';

/**
 * Export Xcode xcloc files
 */
export class XclocExporter extends BasicExporter<XliffParser> {
  constructor({ config }: { config: ExportConfig }) {
    super({
      config,
      parser: new XliffParser(),
      sourceFileContentFn: async (config) => {
        return await this.xlocSourceFileContentFn(config);
      },
      targetFileContentFn: async (config, language) => {
        return await this.xlocTargetFileContentFn(config, language);
      },
    });
  }

  private async xlocSourceFileContentFn(config: ExportConfig) {
    const sourceLanguage = config.sourceLanguage.code;
    // For xcloc files, we need to parse the [lang].xliff file inside the "Localized Contents" folder.
    // For example, if the xcloc file is at "en.xcloc", then we need to parse "en.xcloc/Localized Contents/en.xliff".
    const sourceXliffFilePath = path.join(
      config.sourceLanguage.path,
      `Localized Contents/${sourceLanguage}.xliff`,
    );
    return await fs.promises.readFile(sourceXliffFilePath, 'utf8');
  }

  private async xlocTargetFileContentFn(
    config: ExportLanguageConfig,
    language: string,
  ) {
    // For xcloc files, we need to parse the [lang].xliff file inside the "Localized Contents" folder.
    // For example, if the xcloc file is at "en.xcloc", then we need to parse "en.xcloc/Localized Contents/en.xliff".
    const targetXliffFilePath = path.join(
      config.path,
      `Localized Contents/${language}.xliff`,
    );
    return await fs.promises.readFile(targetXliffFilePath, 'utf8');
  }
}

export class XcodeExporter implements ExportLocalizations {
  private config: ExportConfig;
  private projectPath: string;

  constructor({
    config,
    projectPath,
  }: {
    config: ExportConfig;
    projectPath: string;
    outputFolder: string;
  }) {
    this.config = config;
    this.projectPath = projectPath;
  }

  async export(): Promise<ExportLocalizationsResult> {
    // For xcode, we need export localizations first
    // The export result is a xcloc bundle, so we can use XclocExporter afterwards
    // Bundle:
    // - [en.xcloc]
    // - [zh-Hans.xcloc]
    const xcodeOutputFolder = await createTemporaryOutputFolder();
    logger.info(`Exporting Xcode project to ${xcodeOutputFolder}`);
    const xcodeExporter = new XcodeExportLocalizations(
      this.projectPath,
      [
        this.config.sourceLanguage.code,
        ...this.config.targetLanguages.map((lang) => lang.code),
      ],
      xcodeOutputFolder,
    );
    const result = await xcodeExporter.export();

    logger.info(
      `Exported Xcode project at ${result.bundlePath}, languages: ${result.languages}`,
    );
    // create an export config for xcloc exporter
    const exportConfig: ExportConfig = {
      id: this.config.id,
      sourceLanguage: {
        code: this.config.sourceLanguage.code,
        path: path.join(
          result.bundlePath,
          `${this.config.sourceLanguage.code}.xcloc`,
        ),
      },
      targetLanguages: result.languages.map((language: string) => {
        let bundlePath = absoluteFilePath(
          path.join(result.bundlePath, `${language}.xcloc`),
          this.config.baseFolder,
        );
        return {
          code: language,
          path: bundlePath,
        };
      }),
      baseFolder: this.config.baseFolder,
    };
    let xclocExporter = new XclocExporter({
      config: exportConfig,
    });
    const exported = await xclocExporter.export();
    return {
      ...exported,
      meta: {
        ...exported.meta,
        intermediateBundlePath: result.bundlePath,
      },
    };
  }
}
