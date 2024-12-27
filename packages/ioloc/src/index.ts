import { LocalizationConfig, LocalizationFormat } from '@repo/base/config';
import { logger } from '@repo/base/logger';
import { absoluteFilePath } from '@repo/base/utils';
import fs from 'node:fs';
import path from 'node:path';

import {
  AppleStringsParser,
  BasicExporter,
  ExportConfig,
  ExportParser,
  JsonParser,
  StringCatalogParser,
  TextParser,
  XclocExporter,
  XcodeExporter,
  XliffParser,
} from './export/index.js';
import {
  AppleStringsMerger,
  BasicImporter,
  ImportConfig,
  ImportMerger,
  JSONMerger,
  TextMerger,
  XCStringsMerger,
  XclocImporter,
  XcodeImporter,
  XliffMerger,
} from './import/index.js';
import {
  DOLPHIN_JSON_FILE_NAME,
  DolphinJSON,
  readDolphinJSON,
} from './storage/index.js';
import { createOutputFolderIfNeed } from './utils.js';

export * from './utils.js';

export type ExportLocalizationsResult = {
  json: DolphinJSON;
  meta?: {
    intermediateBundlePath?: string;
  };
};

export interface ExportLocalizations {
  export(): Promise<ExportLocalizationsResult>;
}

/**
 * Export localizations to output folder with specific config.
 * @param config - The localization configuration.
 * @param baseLanguage - The base language code.
 * @param baseFolder - The base folder path.
 * @param outputFolder - The output folder path.
 * @returns The path to the exported localization bundle.
 */
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
}): Promise<{
  json: DolphinJSON;
  outputFolder: string;
  meta?: {
    intermediateBundlePath?: string;
  };
}> {
  const format = config.format;
  if (!('languages' in config)) {
    throw new Error(
      `languages is required for ${format} format in the configuration`,
    );
  }
  let bundlePath = absoluteFilePath(
    config.path.replace('${LANGUAGE}', baseLanguage),
    baseFolder,
  );
  const exportConfig: ExportConfig = {
    id: config.id,
    sourceLanguage: {
      code: baseLanguage,
      path: bundlePath,
    },
    targetLanguages: config.languages.map((language: string) => {
      let bundlePath = absoluteFilePath(
        config.path.replace('${LANGUAGE}', language),
        baseFolder,
      );
      return {
        code: language,
        path: bundlePath,
      };
    }),
    baseFolder: baseFolder,
  };
  let exportResult: ExportLocalizationsResult;
  let parser: ExportParser;
  if (format === LocalizationFormat.XCODE) {
    const exporter = new XcodeExporter({
      projectPath: bundlePath,
      config: exportConfig,
      outputFolder,
    });
    exportResult = await exporter.export();
  } else if (format === LocalizationFormat.XCLOC) {
    const exporter = new XclocExporter({
      config: exportConfig,
    });
    exportResult = await exporter.export();
  } else {
    if (format === LocalizationFormat.TEXT) {
      parser = new TextParser();
    } else if (format === LocalizationFormat.STRINGS) {
      parser = new AppleStringsParser();
    } else if (format === LocalizationFormat.XCSTRINGS) {
      parser = new StringCatalogParser();
    } else if (format === LocalizationFormat.XLIFF) {
      parser = new XliffParser();
    } else if (format === LocalizationFormat.JSON) {
      parser = new JsonParser();
    } else {
      throw new Error(
        `Unsupported bundle format: ${format}. Please contact us to add support for this format.`,
      );
    }
    let exporter = new BasicExporter({
      config: exportConfig,
      parser: parser,
    });
    exportResult = await exporter.export();
  }
  // save the file to output folder
  logger.info(
    `[BasicExporter: ${config.id}]: Saving dolphin json to ${outputFolder}`,
  );
  if (!path.isAbsolute(outputFolder)) {
    throw new Error(
      `[BasicExporter: ${config.id}]: Output folder should be an absolute path: ${outputFolder}`,
    );
  }
  await createOutputFolderIfNeed(outputFolder);
  const dolphinJsonPath = path.join(outputFolder, DOLPHIN_JSON_FILE_NAME);
  if (!exportResult.json.metadata) {
    exportResult.json.metadata = {};
  }
  exportResult.json.metadata = {
    ...exportResult.json.metadata,
    createdAt: new Date().toISOString(),
    lastExportedAt: new Date().toISOString(),
  };
  await fs.promises.writeFile(
    dolphinJsonPath,
    JSON.stringify(exportResult.json, null, 2),
  );
  return {
    json: exportResult.json,
    outputFolder,
    meta: exportResult.meta,
  };
}

export interface ImportLocalizations {
  import(): Promise<void>;
}

export async function importLocalizationBundle({
  config,
  localizationBundlePath,
  baseLanguage,
  baseFolder,
  meta,
}: {
  config: LocalizationConfig;
  localizationBundlePath: string;
  baseLanguage: string;
  baseFolder: string;
  meta?: {
    intermediateBundlePath?: string;
  };
}): Promise<void> {
  logger.info(
    `[ImportLocalizationBundle: ${config.id}]: Importing localization bundle from ${localizationBundlePath}`,
  );
  if (!('languages' in config)) {
    throw new Error(
      `languages is required for ${config.format} format in the configuration`,
    );
  }
  const importBundlePath = absoluteFilePath(localizationBundlePath, baseFolder);
  const dolphinJsonPath = path.join(importBundlePath, DOLPHIN_JSON_FILE_NAME);
  const dolphinJson = await readDolphinJSON(dolphinJsonPath);
  const sourcePath = absoluteFilePath(
    config.path.replace('${LANGUAGE}', baseLanguage),
    baseFolder,
  );
  const importConfig: ImportConfig = {
    id: config.id,
    json: dolphinJson,
    sourceLanguage: {
      code: baseLanguage,
      path: sourcePath,
    },
    targetLanguages: config.languages.map((language: string) => {
      let targetPath = absoluteFilePath(
        config.path.replace('${LANGUAGE}', language),
        baseFolder,
      );
      return {
        code: language,
        path: targetPath,
      };
    }),
    baseFolder: baseFolder,
  };
  if (config.format === LocalizationFormat.XCODE) {
    const intermediateBundlePath = meta?.intermediateBundlePath;
    if (!intermediateBundlePath) {
      throw new Error(
        `[ImportLocalizationBundle: ${config.id}]: Intermediate bundle path is required for Xcode format`,
      );
    }
    const importer = new XcodeImporter({
      config: importConfig,
      intermediateBundlePath,
      projectPath: config.path,
    });
    await importer.import();
  } else if (config.format === LocalizationFormat.XCLOC) {
    const importer = new XclocImporter({ config: importConfig });
    await importer.import();
  } else {
    let merger: ImportMerger;
    if (config.format === LocalizationFormat.TEXT) {
      merger = new TextMerger();
    } else if (config.format === LocalizationFormat.STRINGS) {
      merger = new AppleStringsMerger();
    } else if (config.format === LocalizationFormat.XCSTRINGS) {
      merger = new XCStringsMerger();
    } else if (config.format === LocalizationFormat.XLIFF) {
      merger = new XliffMerger();
    } else if (config.format === LocalizationFormat.JSON) {
      merger = new JSONMerger();
    } else {
      throw new Error(`Unsupported budnle format: ${config.format}`);
    }
    const importer = new BasicImporter({ config: importConfig, merger });
    await importer.import();
  }
  // update lastImportedAt metadata
  if (!dolphinJson.metadata) {
    dolphinJson.metadata = {};
  }
  dolphinJson.metadata.lastImportedAt = new Date().toISOString();
  await fs.promises.writeFile(
    dolphinJsonPath,
    JSON.stringify(dolphinJson, null, 2),
  );
}

export async function replaceBundle(bundlePath: string, other: string) {
  await fs.promises.cp(other, bundlePath, { recursive: true });
}
