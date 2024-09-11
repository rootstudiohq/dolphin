import { LocalizationConfig, LocalizationFormat } from '@repo/base/config';
import { logger } from '@repo/base/logger';
import fs from 'node:fs';
import path from 'node:path';

import {
  BasicExporter,
  ExportConfig,
  XcodeExporter,
  XliffExportParser,
} from './export/index.js';
import { XliffJsonParser } from './export/parser/json.js';
import { XliffAppleStringsParser } from './export/parser/strings.js';
import { XliffTextParser } from './export/parser/text.js';
import { XliffXCStringsParser } from './export/parser/xcstrings.js';
import { XliffParser } from './export/parser/xliff.js';
import { XlocParser } from './export/parser/xloc.js';
import {
  BasicImporter,
  ImportConfig,
  ImportMerger,
  XclocMerger,
  XcodeImporter,
} from './import/index.js';
import { JsonMerger } from './import/merger/json.js';
import { AppleStringsMerger } from './import/merger/strings.js';
import { TextMerger } from './import/merger/text.js';
import { XCStringsMerger } from './import/merger/xcstrings.js';
import { XliffMerger } from './import/merger/xliff.js';
import { createTemporaryOutputFolder } from './utils.js';
import { XcodeExportLocalizations, XcodeImportLocalizations } from './xcode.js';

export * from './utils.js';

export type LocalizationBundlePath = {
  bundlePath: string;
  intermediateBundlePath?: string; // Path to intermediate output artifacts. For example, after exporting from Xcode, the xcloc files will be stored in this folder and can be used for importing localizations afterwards.
};

export interface ExportLocalizations {
  export(): Promise<LocalizationBundlePath>;
}

export async function exportLocalizationBundle({
  config,
  baseLanguage,
  baseFolder,
  outputFolder,
}: {
  config: LocalizationConfig;
  baseLanguage: string;
  baseFolder: string;
  outputFolder: string;
}): Promise<LocalizationBundlePath> {
  const format = config.format;
  if (!('languages' in config)) {
    throw new Error(
      `languages is required for ${format} format in the configuration`,
    );
  }
  let bundlePath = config.path.replace('${LANGUAGE}', baseLanguage);
  if (!path.isAbsolute(bundlePath)) {
    bundlePath = path.join(baseFolder, bundlePath);
  }
  const exportConfig = {
    sourceLanguage: {
      code: baseLanguage,
      path: bundlePath,
    },
    targetLanguages: config.languages.map((language: string) => {
      let bundlePath = config.path.replace('${LANGUAGE}', language);
      if (!path.isAbsolute(bundlePath)) {
        bundlePath = path.join(baseFolder, bundlePath);
      }
      return {
        code: language,
        path: bundlePath,
      };
    }),
    basePath: baseFolder,
  };
  let parser: XliffExportParser;
  if (format === LocalizationFormat.XCODE) {
    const exporter = new XcodeExporter({
      projectPath: bundlePath,
      config: exportConfig,
      outputFolder,
    });
    return await exporter.export();
  } else if (format === LocalizationFormat.XCLOC) {
    parser = new XlocParser();
  } else if (format === LocalizationFormat.TEXT) {
    parser = new XliffTextParser();
  } else if (format === LocalizationFormat.STRINGS) {
    parser = new XliffAppleStringsParser();
  } else if (format === LocalizationFormat.XCSTRINGS) {
    parser = new XliffXCStringsParser();
  } else if (format === LocalizationFormat.XLIFF) {
    parser = new XliffParser();
  } else if (format === LocalizationFormat.JSON) {
    parser = new XliffJsonParser();
  } else {
    throw new Error(
      `Unsupported bundle format: ${format}. Please contact us to add support for this format.`,
    );
  }
  let exporter = new BasicExporter({
    config: exportConfig,
    parser: parser,
    outputFolder,
  });
  return await exporter.export();
}

export interface ImportLocalizationsResult {
  code: number;
}

export interface ImportLocalizations {
  import(): Promise<ImportLocalizationsResult>;
}

export async function importLocalizationBundle({
  config,
  localizationBundlePath,
  baseLanguage,
  baseFolder,
}: {
  config: LocalizationConfig;
  localizationBundlePath: LocalizationBundlePath;
  baseLanguage: string;
  baseFolder: string;
}): Promise<ImportLocalizationsResult> {
  if (!('languages' in config)) {
    throw new Error(
      `languages is required for ${config.format} format in the configuration`,
    );
  }
  let importBundlePath = localizationBundlePath.bundlePath;
  if (!path.isAbsolute(importBundlePath)) {
    importBundlePath = path.join(baseFolder, importBundlePath);
  }
  let sourcePath = config.path.replace('${LANGUAGE}', baseLanguage);
  if (!path.isAbsolute(sourcePath)) {
    sourcePath = path.join(baseFolder, sourcePath);
  }
  let importConfig: ImportConfig = {
    sourceLanguage: {
      code: baseLanguage,
      path: sourcePath,
    },
    targetLanguages: config.languages.map((language: string) => {
      let targetBundlePath = config.path.replace('${LANGUAGE}', language);
      if (!path.isAbsolute(targetBundlePath)) {
        targetBundlePath = path.join(baseFolder, targetBundlePath);
      }
      return {
        code: language,
        from: path.join(importBundlePath, `${language}.xliff`),
        to: targetBundlePath,
      };
    }),
  };
  let merger: ImportMerger;
  if (config.format === LocalizationFormat.XCODE) {
    const importer = new XcodeImporter({
      config: importConfig,
      localizationBundlePath,
      projectPath: config.path,
      baseFolder,
    });
    return await importer.import();
  } else if (config.format === LocalizationFormat.XCLOC) {
    merger = new XclocMerger();
  } else if (config.format === LocalizationFormat.TEXT) {
    merger = new TextMerger();
  } else if (config.format === LocalizationFormat.STRINGS) {
    merger = new AppleStringsMerger();
  } else if (config.format === LocalizationFormat.XCSTRINGS) {
    merger = new XCStringsMerger();
  } else if (config.format === LocalizationFormat.XLIFF) {
    merger = new XliffMerger();
  } else if (config.format === LocalizationFormat.JSON) {
    merger = new JsonMerger();
  } else {
    throw new Error(`Unsupported budnle format: ${config.format}`);
  }
  const importer = new BasicImporter({ config: importConfig, merger });
  return await importer.import();
}

export async function replaceBundle(bundlePath: string, other: string) {
  await fs.promises.cp(other, bundlePath, { recursive: true });
}
