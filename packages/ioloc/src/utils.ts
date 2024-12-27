import { logger } from '@repo/base/logger';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export async function createTemporaryOutputFolder() {
  const outputFolder = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), `dolphin-export-`),
  );
  return outputFolder;
}

export async function createOutputFolderIfNeed(
  folder?: string,
): Promise<string> {
  var outputFolder = folder;
  if (!outputFolder) {
    // create temporary output folder for bundle file
    outputFolder = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'dolphin-export-'),
    );
    logger.info(`Created temporary folder: ${outputFolder} as output folder`);
  }

  // make sure valid output folder exists
  try {
    if (!(await fs.promises.stat(outputFolder)).isDirectory()) {
      throw new Error(`${outputFolder} is not a directory.`);
    }
  } catch (e) {
    // check if is ENOENT error
    if ((e as any).code === 'ENOENT') {
      logger.info(`${outputFolder} does not exist. Try creating it.`);
      await fs.promises.mkdir(outputFolder, { recursive: true });
    } else {
      throw e;
    }
  }
  return outputFolder;
}
