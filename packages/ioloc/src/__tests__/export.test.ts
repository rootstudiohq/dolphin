import { LocalizationFormat } from '@repo/base/config';
import { writeFile } from '@repo/base/utils';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import {
  createTemporaryOutputFolder,
  exportLocalizationBundle,
} from '../index.js';
import { DolphinJSON } from '../storage/index.js';

describe('exportLocalizationBundle e2e', async () => {
  const testDir = await createTemporaryOutputFolder();
  const sourceDir = path.join(testDir, 'source');
  const outputDir = path.join(testDir, '.dolphin');

  beforeEach(() => {
    // Create test directories
    fs.mkdirSync(testDir, { recursive: true });
    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directories
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('should export localization bundle from source files', async () => {
    // Create test source files
    const sourceContent = {
      'en.json': {
        greeting: 'Hello',
        farewell: 'Goodbye',
      },
      'ja.json': {
        greeting: 'こんにちは',
        farewell: 'さようなら',
      },
    };

    for (const [filename, content] of Object.entries(sourceContent)) {
      await writeFile(
        path.join(sourceDir, filename),
        JSON.stringify(content, null, 2),
      );
    }

    // Export the bundle
    await exportLocalizationBundle({
      config: {
        path: path.join(sourceDir, '${LANGUAGE}.json'),
        id: 'test-export',
        format: LocalizationFormat.JSON,
        languages: ['ja'],
      },
      baseLanguage: 'en',
      baseFolder: sourceDir,
      outputFolder: outputDir,
    });

    // Verify the exported dolphin.json
    const exportedPath = path.join(outputDir, 'dolphin.json');
    expect(fs.existsSync(exportedPath)).toBe(true);

    const exportedContent: DolphinJSON = JSON.parse(
      fs.readFileSync(exportedPath, 'utf-8'),
    );

    // Verify basic structure
    expect(exportedContent).toMatchObject({
      version: '1.0',
      fileId: 'test-export',
      sourceLanguage: 'en',
    });

    // Verify strings were exported correctly
    expect(exportedContent.strings).toMatchObject({
      greeting: {
        localizations: {
          en: {
            value: 'Hello',
            state: 'new',
            metadata: {
              extractedFrom: 'source',
            },
          },
          ja: {
            value: 'こんにちは',
            state: 'undefined',
            metadata: {
              extractedFrom: 'existing',
            },
          },
        },
      },
      farewell: {
        localizations: {
          en: {
            value: 'Goodbye',
            state: 'new',
            metadata: {
              extractedFrom: 'source',
            },
          },
          ja: {
            value: 'さようなら',
            state: 'undefined',
            metadata: {
              extractedFrom: 'existing',
            },
          },
        },
      },
    });
  });

  test('should merge with existing bundle', async () => {
    // Create existing dolphin.json
    const existingBundle: DolphinJSON = {
      version: '1.0',
      fileId: 'test-export',
      sourceLanguage: 'en',
      strings: {
        greeting: {
          localizations: {
            en: {
              value: 'Hello',
              state: 'reviewed',
            },
            ja: {
              value: 'こんにちは',
              state: 'reviewed',
            },
          },
        },
      },
    };

    fs.writeFileSync(
      path.join(outputDir, 'dolphin.json'),
      JSON.stringify(existingBundle, null, 2),
    );

    // Create new source files
    const sourceContent = {
      'en.json': {
        greeting: 'Hello', // Same as existing
        farewell: 'Goodbye', // New string
      },
      'ja.json': {
        greeting: 'ハロー', // Different from existing
        farewell: 'さようなら',
      },
    };

    for (const [filename, content] of Object.entries(sourceContent)) {
      fs.writeFileSync(
        path.join(sourceDir, filename),
        JSON.stringify(content, null, 2),
      );
    }

    // Export and merge
    await exportLocalizationBundle({
      config: {
        path: path.join(sourceDir, '${LANGUAGE}.json'),
        id: 'test-export',
        format: LocalizationFormat.JSON,
        languages: ['ja'],
      },
      baseLanguage: 'en',
      baseFolder: sourceDir,
      outputFolder: outputDir,
    });

    // Verify the merged result
    const exportedContent: DolphinJSON = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'dolphin.json'), 'utf-8'),
    );

    expect(exportedContent.strings).toMatchObject({
      greeting: {
        localizations: {
          en: {
            value: 'Hello',
            state: 'new', // Preserved from existing
            metadata: {
              extractedFrom: 'source',
            },
          },
          ja: {
            value: 'ハロー', // Preserved from existing
            state: 'undefined',
            metadata: {
              extractedFrom: 'existing',
            },
          },
        },
      },
      farewell: {
        localizations: {
          en: {
            value: 'Goodbye',
            state: 'new', // New string
            metadata: {
              extractedFrom: 'source',
            },
          },
          ja: {
            value: 'さようなら',
            state: 'undefined',
            metadata: {
              extractedFrom: 'existing',
            },
          },
        },
      },
    });
  });

  test('should handle missing translations', async () => {
    // Create source files with missing translations
    const sourceContent = {
      'en.json': {
        greeting: 'Hello',
        farewell: 'Goodbye',
      },
      'ja.json': {
        greeting: 'こんにちは',
        // farewell is missing
      },
    };

    for (const [filename, content] of Object.entries(sourceContent)) {
      fs.writeFileSync(
        path.join(sourceDir, filename),
        JSON.stringify(content, null, 2),
      );
    }

    await exportLocalizationBundle({
      config: {
        path: path.join(sourceDir, '${LANGUAGE}.json'),
        id: 'test-export',
        format: LocalizationFormat.JSON,
        languages: ['ja'],
      },
      baseLanguage: 'en',
      baseFolder: sourceDir,
      outputFolder: outputDir,
    });

    const exportedContent: DolphinJSON = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'dolphin.json'), 'utf-8'),
    );

    expect(exportedContent.strings.farewell.localizations).toMatchObject({
      en: {
        value: 'Goodbye',
        state: 'new',
        metadata: {
          extractedFrom: 'source',
        },
      },
      ja: {
        state: 'new', // Missing translation marked as new
        metadata: {
          extractedFrom: 'undefined',
        },
      },
    });
  });
});
