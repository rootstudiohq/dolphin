import { XcodeProject } from '@bacons/xcode';
import { logger } from '@repo/base/logger';
import { absoluteFilePath } from '@repo/base/utils';
import child_process from 'child_process';
import { spawn } from 'child_process';
import fs from 'node:fs';
import path from 'node:path';

import { createOutputFolderIfNeed } from './utils.js';

const XcodeCommonArgs =
  '-disableAutomaticPackageResolution -onlyUsePackageVersionsFromResolvedFile -skipPackageUpdates';

export type ImportOptions = {};

export type ImportResult = {
  code: number;
};

export class XcodeExportLocalizations {
  constructor(
    private projectPath: string,
    private langauges: string[],
    private baseFolder: string,
    private outputFolder?: string,
  ) {}

  async export(): Promise<{
    bundlePath: string;
    languages: string[];
  }> {
    // check if xcodebuild command is available
    try {
      child_process.execSync('/usr/bin/xcodebuild -version');
    } catch (e) {
      throw new Error(
        'xcodebuild command is not available. Make sure you have Xcode installed.',
      );
    }

    const outputFolder = await createOutputFolderIfNeed(this.outputFolder);

    const absoluteProjectPath = absoluteFilePath(
      this.projectPath,
      this.baseFolder,
    );
    // get all known regions
    const xcodeProject = XcodeProject.open(
      path.join(absoluteProjectPath, 'project.pbxproj'),
    );
    const developmentRegion = xcodeProject.rootObject.props.developmentRegion;
    const knownRegions = xcodeProject.rootObject.props.knownRegions;
    logger.info(`Found known regions: ${knownRegions.join(', ')}`);
    // make sure all languages are in known regions
    const unknownLanguages = this.langauges.filter(
      (lang) => !knownRegions.includes(lang),
    );
    if (unknownLanguages.length > 0) {
      throw new Error(
        `The following languages are not in xcode project regions: ${unknownLanguages.join(', ')}`,
      );
    }

    // run exportLocaizations command
    let exportRegions: string[] = [];
    let command = `/usr/bin/xcodebuild -exportLocalizations -project ${absoluteProjectPath} -localizationPath ${outputFolder} ${XcodeCommonArgs}`;
    for (const region of this.langauges) {
      command += ` -exportLanguage ${region}`;
      exportRegions.push(region);
    }
    logger.info(`Running command: ${command}`);
    const result = await exec(command);
    if (result.code !== 0) {
      throw new Error(
        `xcodebuild exportLocalizations command failed with code: ${result.code}`,
      );
    }

    // check if we get all the xcloc files
    const xclocPaths = (
      await fs.promises.readdir(outputFolder, { withFileTypes: true })
    )
      .filter(
        (direntory) =>
          direntory.isDirectory() && direntory.name.endsWith('.xcloc'),
      )
      .map((dirent) => dirent.name)
      .sort();
    const expectedFiles = exportRegions
      .map((region) => `${region}.xcloc`)
      .sort();
    if (
      xclocPaths.length !== expectedFiles.length ||
      !xclocPaths.every((value, index) => value === expectedFiles[index])
    ) {
      throw new Error(
        `Failed to export all xcloc files, expected: ${expectedFiles
          .sort()
          .join(', ')}, found: ${xclocPaths.sort().join(', ')}`,
      );
    }
    return {
      bundlePath: outputFolder,
      languages: exportRegions,
    };
  }
}

export class XcodeImportLocalizations {
  async import({
    localizationBundlePath,
    projectPath,
    baseFolder,
  }: {
    localizationBundlePath: string;
    projectPath: string;
    baseFolder: string;
  }): Promise<ImportResult> {
    // check if xcodebuild command is available
    try {
      child_process.execSync('/usr/bin/xcodebuild -version');
    } catch (e) {
      throw new Error(
        'xcodebuild command is not available. Make sure you have Xcode installed.',
      );
    }

    const absoluteProjectPath = absoluteFilePath(projectPath, baseFolder);
    // run importLocaizations command
    const xclocPaths = (
      await fs.promises.readdir(localizationBundlePath, { withFileTypes: true })
    )
      .filter(
        (direntory) =>
          direntory.isDirectory() && direntory.name.endsWith('.xcloc'),
      )
      .map((dirent) => path.join(localizationBundlePath, dirent.name))
      .sort();
    logger.info(`Found xcloc files: ${xclocPaths.join(', ')}`);
    for (const xclocPath of xclocPaths) {
      const command = `/usr/bin/xcodebuild -importLocalizations -project ${absoluteProjectPath} -localizationPath ${xclocPath} -mergeImport ${XcodeCommonArgs}`;
      logger.info(`Running command: ${command}`);
      const result = await exec(command);
      if (result.code !== 0) {
        throw new Error(
          `xcodebuild importLocalizations command failed with code: ${result.code}`,
        );
      }
    }
    return {
      code: 0,
    };
  }
}

async function exec(command: string): Promise<{ code: number }> {
  return new Promise((resolve) => {
    const [cmd, ...args] = command.split(' ');
    const childProcess = spawn(cmd, args, { stdio: 'inherit' });

    childProcess.on('close', (code) => {
      resolve({ code: code ?? 0 });
    });
  });
}
