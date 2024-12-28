import fs from 'node:fs';
import path from 'node:path';

export function absoluteFilePath(filePath: string, baseFolder: string): string {
  if (!path.isAbsolute(filePath)) {
    return path.join(baseFolder, filePath);
  }
  return filePath;
}

export async function mkdirIfNotExists(filePath: string) {
  const fileFolder = path.dirname(filePath);
  if (!fs.existsSync(fileFolder)) {
    await fs.promises.mkdir(fileFolder, { recursive: true });
  }
}

export async function writeEmptyFile(filePath: string) {
  await mkdirIfNotExists(filePath);
  await fs.promises.writeFile(filePath, '');
}

export async function writeFile(filePath: string, content: string) {
  await mkdirIfNotExists(filePath);
  await fs.promises.writeFile(filePath, content);
}
