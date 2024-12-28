import { Config, LocalizationFormat, parseConfig } from '@repo/base/config';
import { consoleLogger, logger } from '@repo/base/logger';
import spinner from '@repo/base/spinner';
import { absoluteFilePath } from '@repo/base/utils';
import { createTemporaryOutputFolder, replaceBundle } from '@repo/ioloc';
import {
  exportLocalizationBundle,
  importLocalizationBundle,
} from '@repo/ioloc';
import { mergeBundles, translateBundle } from '@repo/translate';
import chalk from 'chalk';
import path from 'node:path';

export async function loadConfig({ path }: { path?: string }) {
  var startTime = performance.now();
  spinner.update('Loading config').start();
  const config = await parseConfig(path);
  var duration = formattedDuration(performance.now() - startTime);
  spinner.succeed(chalk.green(`Configuration loaded (${duration})`));
  consoleLogger.info(
    chalk.gray(
      `${JSON.stringify(
        config,
        (key, value) => {
          if (key === 'apiUrl') {
            return undefined;
          } else {
            return value;
          }
        },
        2,
      )}\n`,
    ),
  );
  return config;
}

export async function exportLocalizations(config: Config) {
  var startTime = performance.now();
  const exportingMessage =
    config.localizations.filter((x) => x.format === LocalizationFormat.XCODE)
      .length > 0
      ? `Exporting localizations (Xcode project takes a while since it needs to be built)`
      : 'Exporting localizations';
  spinner.update(exportingMessage).start();
  const baseFolder = path.dirname(config.path);
  var exportedResults: {
    id: string;
    path: string;
    meta?: {
      intermediateBundlePath?: string;
    };
  }[] = [];
  const baseOutputFolder = absoluteFilePath(
    config.exportFolder || '.dolphin',
    baseFolder,
  );
  const temporaryOutputFolder = await createTemporaryOutputFolder();
  for (const localizationConfig of config.localizations) {
    // export to temporary folder first and then merge into baseOutputFolder
    let outputFolder = path.join(
      temporaryOutputFolder,
      localizationFolderName(localizationConfig.id),
    );
    const exportResult = await exportLocalizationBundle({
      config: localizationConfig,
      baseLanguage: config.baseLanguage,
      baseFolder,
      outputFolder,
    });
    exportedResults.push({
      id: localizationConfig.id,
      path: exportResult.outputFolder,
      meta: exportResult.meta,
    });
  }
  const exportedBundlePaths = exportedResults.map((result) => result.path);
  logger.info(`Merging with previous translations...`);
  for (const result of exportedResults) {
    logger.info(`Merging ${result.id}...`);
    const newBundleFolder = path.join(temporaryOutputFolder, result.id);
    const previousBundleFolder = path.join(baseOutputFolder, result.id);
    await mergeBundles({
      newBundleFolder,
      previousBundleFolder,
    });
  }
  logger.info(
    `Base output folder: ${baseOutputFolder}, temporary output folder: ${temporaryOutputFolder}`,
  );
  await replaceBundle(baseOutputFolder, temporaryOutputFolder);
  const duration = formattedDuration(performance.now() - startTime);
  spinner.succeed(
    chalk.green(
      `${exportedResults.length} localization bundles exported (${duration})`,
    ),
  );
  consoleLogger.info(
    chalk.gray(`${JSON.stringify(exportedBundlePaths, null, 2)}\n`),
  );
  logger.info(
    `Exported ${
      exportedResults.length
    } localization bundles at ${exportedBundlePaths.join(', ')}`,
  );
  return {
    baseOutputFolder,
    exportedResults,
  };
}

export async function translateLocalizations({
  baseOutputFolder,
  config,
}: {
  baseOutputFolder: string;
  config: Config;
}) {
  const startTime = performance.now();
  spinner.update('Translating localizations', {
    logging: false,
  });
  logger.info(`Translating localization bundle at ${baseOutputFolder}`);
  await translateBundle(baseOutputFolder, config, spinner);
  const duration = formattedDuration(performance.now() - startTime);
  spinner.succeed(chalk.green(`Finished translation process (${duration})\n`));
}

export async function importLocalizations({
  config,
  translationBundle,
  metas,
}: {
  config: Config;
  translationBundle: string;
  metas: {
    [key: string]: {
      intermediateBundlePath?: string;
    };
  };
}) {
  const startTime = performance.now();
  const containsXcodeFormat =
    config.localizations.filter((x) => x.format === LocalizationFormat.XCODE)
      .length > 0;
  let message = 'Merging translations';
  if (containsXcodeFormat) {
    message += ' (Xcode project may take a while)';
  }
  spinner.next(message).start();
  logger.info(`Merging localization bundles...`);
  for (var index = 0; index < config.localizations.length; index++) {
    const localizationConfig = config.localizations[index];
    const bundlePath = path.join(
      translationBundle,
      localizationFolderName(localizationConfig.id),
    );
    await importLocalizationBundle({
      config: localizationConfig,
      localizationBundlePath: bundlePath,
      baseLanguage: config.baseLanguage,
      baseFolder: path.dirname(config.path),
      meta: metas[localizationConfig.id],
    });
  }
  const duration = formattedDuration(performance.now() - startTime);
  spinner.succeed(chalk.green(`Translations merged (${duration})\n`));
}

export function formattedDuration(duration: number) {
  if (duration < 1000) {
    return `${duration.toFixed(2)}ms`;
  } else {
    return `${(duration / 1000).toFixed(2)}s`;
  }
}

function localizationFolderName(id: string) {
  return id;
}
