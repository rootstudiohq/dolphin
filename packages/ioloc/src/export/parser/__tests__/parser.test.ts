import {
  AppleStringsParser,
  ExportParser,
  JsonParser,
  StringCatalogParser,
  TextParser,
  XliffParser,
} from '@/export/index.js';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

async function testParserExportSource(parser: ExportParser, format: string) {
  const json = await parser.exportSource({
    fileId: '1',
    content: fs.readFileSync(
      path.join(__dirname, `./fixtures/en.${format}`),
      'utf-8',
    ),
    language: 'en',
  });
  expect(json).toEqual(
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, `./fixtures/source.${format}.json`),
        'utf-8',
      ),
    ),
  );
}

async function testParserExportTarget(parser: ExportParser, format: string) {
  let json = await parser.exportSource({
    fileId: '1',
    content: fs.readFileSync(
      path.join(__dirname, `./fixtures/en.${format}`),
      'utf-8',
    ),
    language: 'en',
  });
  const targetJson = await parser.exportTarget({
    fileId: '1',
    content: fs.readFileSync(
      path.join(__dirname, `./fixtures/zh.${format}`),
      'utf-8',
    ),
    language: 'zh',
    json,
  });
  expect(targetJson).toEqual(
    JSON.parse(
      fs.readFileSync(
        path.join(__dirname, `./fixtures/target.${format}.json`),
        'utf-8',
      ),
    ),
  );
  const emptyTargetJson = await parser.exportTarget({
    fileId: '1',
    content: '',
    language: 'jp',
    json,
  });
  expect(emptyTargetJson).toEqual(json);
}

test('json parser to export source', async () => {
  const parser = new JsonParser();
  await testParserExportSource(parser, 'json');
});

test('json parser to export target', async () => {
  const parser = new JsonParser();
  await testParserExportTarget(parser, 'json');
});

test('strings parser to export source', async () => {
  const parser = new AppleStringsParser();
  await testParserExportSource(parser, 'strings');
});

test('strings parser to export target', async () => {
  const parser = new AppleStringsParser();
  await testParserExportTarget(parser, 'strings');
});

test('text parser to export source', async () => {
  const parser = new TextParser();
  await testParserExportSource(parser, 'txt');
});

test('text parser to export target', async () => {
  const parser = new TextParser();
  await testParserExportTarget(parser, 'txt');
});

test('xcstrings parser to export source', async () => {
  const parser = new StringCatalogParser();
  await testParserExportSource(parser, 'xcstrings');
});

test('xcstrings parser to export target', async () => {
  const parser = new StringCatalogParser();
  await testParserExportTarget(parser, 'xcstrings');
});

test('xliff parser to export source', async () => {
  const parser = new XliffParser();
  await testParserExportSource(parser, 'xliff');
});

test('xliff parser to export target', async () => {
  const parser = new XliffParser();
  await testParserExportTarget(parser, 'xliff');
});
