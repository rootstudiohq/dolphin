import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';

import { DolphinJSON } from '../../../storage/index.js';
import { JSONMerger } from '../json.js';
import { AppleStringsMerger } from '../strings.js';
import { TextMerger } from '../text.js';
import { XCStringsMerger } from '../xcstrings.js';
import { XliffMerger } from '../xliff.js';

// Test utilities
let TEST_OUTPUT_DIR: string;

beforeEach(async () => {
  // Create a temporary directory
  TEST_OUTPUT_DIR = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'ioloc-merger-test-'),
  );
});

afterEach(async () => {
  // Clean up temporary directory
  if (TEST_OUTPUT_DIR) {
    await fs.promises.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
  }
});

async function testMerger(format: string, targetLanguage: string = 'zh') {
  // Read translation JSON
  const translationJson: DolphinJSON = JSON.parse(
    await fs.promises.readFile(
      path.join(__dirname, `./fixtures/translation.${format}.json`),
      'utf-8',
    ),
  );

  // Create output path
  const outputPath = path.join(TEST_OUTPUT_DIR, `output.${format}`);
  const sourcePath = path.join(__dirname, `./fixtures/en.${format}`);

  // Get the appropriate merger
  const mergers = {
    json: new JSONMerger(),
    strings: new AppleStringsMerger(),
    txt: new TextMerger(),
    xcstrings: new XCStringsMerger(),
    xliff: new XliffMerger(),
  };
  const merger = mergers[format as keyof typeof mergers];

  // Merge the translations
  await merger.merge({
    json: translationJson,
    sourceFilePath: sourcePath,
    targetLanguage,
    targetFilePath: outputPath,
  });

  // Read the output and expected files
  const output = await fs.promises.readFile(outputPath, 'utf-8');
  const expected = await fs.promises.readFile(
    path.join(__dirname, `./fixtures/${targetLanguage}.${format}`),
    'utf-8',
  );

  // Compare the output with expected result
  // For JSON files, parse and compare objects to ignore formatting differences
  if (format === 'json' || format === 'xcstrings') {
    expect(JSON.parse(output)).toEqual(JSON.parse(expected));
  } else {
    expect(output).toEqual(expected);
  }
}

test('JSON merger', async () => {
  await testMerger('json');
});

test('Strings merger', async () => {
  await testMerger('strings');
});

test('Text merger', async () => {
  await testMerger('txt');
});

test('XCStrings merger', async () => {
  await testMerger('xcstrings');
});

test('XLIFF merger', async () => {
  await testMerger('xliff');
});

// Test empty/missing translations
// test('Merger handles missing translations', async () => {
//   const sourceJson: DolphinJSON = {
//     sourceLanguage: 'en',
//     strings: {
//       'test.key': {
//         value: 'Test value',
//         comment: 'Test comment',
//       },
//     },
//     translations: {},
//   };

//   const outputPath = path.join(TEST_OUTPUT_DIR, 'output.json');
//   const merger = new JSONMerger();

//   await merger.merge({
//     json: sourceJson,
//     sourceFilePath: '',
//     targetLanguage: 'fr',
//     targetFilePath: outputPath,
//   });

//   const output = await fs.promises.readFile(outputPath, 'utf-8');
//   expect(JSON.parse(output)).toEqual({});
// });

// Test error cases
// test('Text merger throws error with multiple strings', async () => {
//   const sourceJson: DolphinJSON = {
//     sourceLanguage: 'en',
//     strings: {
//       key1: { value: 'Value 1' },
//       key2: { value: 'Value 2' },
//     },
//     translations: {
//       zh: {
//         key1: 'Translation 1',
//         key2: 'Translation 2',
//       },
//     },
//   };

//   const merger = new TextMerger();
//   const outputPath = path.join(TEST_OUTPUT_DIR, 'output.txt');

//   await expect(
//     merger.merge({
//       json: sourceJson,
//       sourceFilePath: '',
//       targetLanguage: 'zh',
//       targetFilePath: outputPath,
//     }),
//   ).rejects.toThrow('Invalid json format for text file');
// });
