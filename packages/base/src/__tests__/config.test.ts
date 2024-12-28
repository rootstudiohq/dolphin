import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { LocalizationFormat, parseConfig, parseConfigText } from '../config';

describe('Config Parser', () => {
  it('should throw error when no config path provided', async () => {
    await expect(parseConfig(undefined)).rejects.toThrow('Missing config file');
  });

  it('should throw error for invalid config path', async () => {
    await expect(
      parseConfig('/some-invalid/path/config.yml'),
    ).rejects.toThrow();
  });

  it('should parse valid config file', async () => {
    const configContent = `
baseLanguage: en
translator:
  agent: openai
  mode: automatic
  maxOutputTokens: 4096
  buffer: 0.3
  maxRetry: 1
  tokenizer: openai
  tokenizerModel: gpt-4
localizations:
  - id: strings
    path: ./Localizable.strings
    format: strings
`;

    const config = await parseConfigText({
      yamlText: configContent,
      configPath: '/virtual/dolphin.yml',
    });

    expect(config).toMatchObject({
      baseLanguage: 'en',
      translator: {
        agent: 'openai',
        mode: 'automatic',
        maxOutputTokens: 4096,
      },
      localizations: [
        {
          id: 'strings',
          path: './Localizable.strings',
          format: LocalizationFormat.STRINGS,
        },
      ],
    });
  });

  it('should throw error for duplicate localization ids', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dolphin-test-'));
    const configPath = path.join(tmpDir, 'dolphin.yml');

    const configContent = `
baseLanguage: en
translator:
  agent: openai
  mode: automatic
localizations:
  - id: strings
    path: ./Localizable1.strings
    format: strings
  - id: strings
    path: ./Localizable2.strings
    format: strings
`;

    await fs.writeFile(configPath, configContent);

    await expect(parseConfig(configPath)).rejects.toThrow(
      'Duplicate localization id',
    );

    // Cleanup
    await fs.rm(tmpDir, { recursive: true });
  });

  it('should parse text format with languages', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dolphin-test-'));
    const configPath = path.join(tmpDir, 'dolphin.yml');

    const configContent = `
baseLanguage: en
translator:
  agent: openai
  mode: automatic
localizations:
  - id: text
    path: ./translations
    format: text
    languages: ['en', 'es', 'fr']
`;

    await fs.writeFile(configPath, configContent);

    const config = await parseConfig(configPath);

    expect(config.localizations[0]).toMatchObject({
      id: 'text',
      path: './translations',
      format: LocalizationFormat.TEXT,
      languages: ['en', 'es', 'fr'],
    });

    // Cleanup
    await fs.rm(tmpDir, { recursive: true });
  });

  describe('parseConfigText', () => {
    it('should parse valid config text', async () => {
      const configContent = `
baseLanguage: en
translator:
  agent: openai
  mode: automatic
  maxOutputTokens: 4096
  buffer: 0.3
  maxRetry: 1
  tokenizer: openai
  tokenizerModel: gpt-4
localizations:
  - id: strings
    path: ./Localizable.strings
    format: strings
`;

      const config = await parseConfigText({
        yamlText: configContent,
        configPath: '/virtual/dolphin.yml',
      });

      expect(config).toMatchObject({
        baseLanguage: 'en',
        translator: {
          agent: 'openai',
          mode: 'automatic',
          maxOutputTokens: 4096,
        },
        localizations: [
          {
            id: 'strings',
            path: './Localizable.strings',
            format: LocalizationFormat.STRINGS,
          },
        ],
      });
    });

    it('should validate required fields', async () => {
      const invalidConfig = `
translator:
  agent: openai
  mode: automatic
localizations:
  - id: strings
    path: ./Localizable.strings
    format: strings
`;

      await expect(
        parseConfigText({
          yamlText: invalidConfig,
          configPath: '/virtual/dolphin.yml',
        }),
      ).rejects.toThrow('Invalid config file');
    });

    it('should parse dolphin translator config', async () => {
      const configContent = `
baseLanguage: en
translator:
  agent: api
  mode: interactive
  baseUrl: http://localhost:3000
localizations:
  - id: strings
    path: ./Localizable.strings
    format: strings
`;

      const config = await parseConfigText({
        yamlText: configContent,
        configPath: '/virtual/dolphin.yml',
      });

      expect(config.translator).toMatchObject({
        agent: 'api',
        mode: 'interactive',
        baseUrl: 'http://localhost:3000',
      });
    });

    it('should validate translator config', async () => {
      const invalidConfig = `
baseLanguage: en
translator:
  agent: invalid-agent
  mode: automatic
localizations:
  - id: strings
    path: ./Localizable.strings
    format: strings
`;

      await expect(
        parseConfigText({
          yamlText: invalidConfig,
          configPath: '/virtual/dolphin.yml',
        }),
      ).rejects.toThrow('Invalid config file');
    });

    it('should validate localization format', async () => {
      const invalidConfig = `
baseLanguage: en
translator:
  agent: openai
  mode: automatic
localizations:
  - id: strings
    path: ./Localizable.strings
    format: invalid-format
`;

      await expect(
        parseConfigText({
          yamlText: invalidConfig,
          configPath: '/virtual/dolphin.yml',
        }),
      ).rejects.toThrow('Invalid config file');
    });

    it('should parse config with optional fields', async () => {
      const configContent = `
baseLanguage: en
translator:
  agent: openai
  mode: automatic
exportFolder: ./translations
globalContext: This is a global context
localizations:
  - id: strings
    path: ./Localizable.strings
    format: strings
`;

      const config = await parseConfigText({
        yamlText: configContent,
        configPath: '/virtual/dolphin.yml',
      });

      expect(config).toMatchObject({
        exportFolder: './translations',
        globalContext: 'This is a global context',
      });
    });
  });
});
