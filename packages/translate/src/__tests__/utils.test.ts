import { DolphinJSON } from '@repo/ioloc/storage';
import { describe, expect, test } from 'vitest';

import { mergeDolphinJsons } from '../utils.js';

const createBaseDolphinJson = (overrides = {}): DolphinJSON => ({
  version: '1.0',
  fileId: 'test-file',
  sourceLanguage: 'en',
  strings: {},
  ...overrides,
});

describe('mergeDolphinJsons', () => {
  test('should throw error if versions mismatch', () => {
    const newJson = createBaseDolphinJson({ version: '2.0' as any });
    const previousJson = createBaseDolphinJson();

    expect(() => mergeDolphinJsons({ newJson, previousJson })).toThrow(
      'Mismatched version',
    );
  });

  test('should throw error if fileIds mismatch', () => {
    const newJson = createBaseDolphinJson({ fileId: 'new-file' });
    const previousJson = createBaseDolphinJson({ fileId: 'old-file' });

    expect(() => mergeDolphinJsons({ newJson, previousJson })).toThrow(
      'File ID mismatch',
    );
  });

  test('should throw error if source languages mismatch', () => {
    const newJson = createBaseDolphinJson({ sourceLanguage: 'ja' });
    const previousJson = createBaseDolphinJson({ sourceLanguage: 'en' });

    expect(() => mergeDolphinJsons({ newJson, previousJson })).toThrow(
      'Source language mismatch',
    );
  });

  test('should preserve new string if comments differ', () => {
    const newJson = createBaseDolphinJson({
      strings: {
        key1: {
          comment: 'New comment',
          localizations: {
            en: { value: 'Hello', state: 'new' },
            ja: { value: 'こんにちは', state: 'new' },
          },
        },
      },
    });

    const previousJson = createBaseDolphinJson({
      strings: {
        key1: {
          comment: 'Old comment',
          localizations: {
            en: { value: 'Hello', state: 'translated' },
            ja: { value: 'こんにちは', state: 'translated' },
          },
        },
      },
    });

    mergeDolphinJsons({ newJson, previousJson });
    expect(newJson.strings.key1.localizations.ja.state).toBe('new');
  });

  test('should merge when target is different', () => {
    const newJson = createBaseDolphinJson({
      strings: {
        key1: {
          comment: 'Same comment',
          localizations: {
            en: { value: 'Hello', state: 'translated' },
            ja: { value: 'ハロー', state: 'new' },
            fr: { value: 'Bonjour', state: 'new' },
          },
        },
      },
    });

    const previousJson = createBaseDolphinJson({
      strings: {
        key1: {
          comment: 'Same comment',
          localizations: {
            en: { value: 'Hello', state: 'translated' },
            ja: { value: 'こんにちは', state: 'reviewed' },
            fr: { value: 'Salut', state: 'new' },
          },
        },
      },
    });

    mergeDolphinJsons({ newJson, previousJson });
    expect(newJson.strings.key1.localizations).toEqual({
      en: { value: 'Hello', state: 'translated' },
      ja: { value: 'ハロー', state: 'new' },
      fr: { value: 'Bonjour', state: 'new' }, // Keeps new value since previous was 'new'
    });
  });

  test('should preserve skip flag from previous translations', () => {
    const newJson = createBaseDolphinJson({
      strings: {
        key1: {
          comment: 'Same comment',
          localizations: {
            en: { value: 'Hello', state: 'new' },
            ja: { value: 'ハロー', state: 'new' },
          },
        },
      },
    });

    const previousJson = createBaseDolphinJson({
      strings: {
        key1: {
          comment: 'Same comment',
          localizations: {
            en: { value: 'Hello', state: 'translated' },
            ja: { value: 'こんにちは', state: 'reviewed', skip: true },
          },
        },
      },
    });

    mergeDolphinJsons({ newJson, previousJson });
    expect(newJson.strings.key1.localizations.ja.skip).toBe(true);
  });

  test('should merge metadata from previous translations', () => {
    const newJson = createBaseDolphinJson({
      strings: {
        key1: {
          comment: 'Same comment',
          localizations: {
            en: { value: 'Hello', state: 'new' },
            ja: {
              value: 'ハロー',
              state: 'new',
              metadata: { newMeta: 'new', oldMeta: 'old update' },
            },
          },
        },
      },
    });

    const previousJson = createBaseDolphinJson({
      strings: {
        key1: {
          comment: 'Same comment',
          localizations: {
            en: { value: 'Hello', state: 'new' },
            ja: {
              value: 'こんにちは',
              state: 'reviewed',
              metadata: { oldMeta: 'old', oldMeta2: 'old2' },
            },
          },
        },
      },
    });

    mergeDolphinJsons({ newJson, previousJson });
    expect(newJson.strings.key1.localizations.ja.metadata).toEqual({
      newMeta: 'new',
      oldMeta: 'old update',
      oldMeta2: 'old2',
    });
  });

  test('should set state to new json when source value changes', () => {
    const newJson = createBaseDolphinJson({
      strings: {
        key1: {
          comment: 'Same comment',
          localizations: {
            en: { value: 'Updated Hello', state: 'new' },
            ja: { value: 'こんにちは', state: 'new' },
          },
        },
      },
    });

    const previousJson = createBaseDolphinJson({
      strings: {
        key1: {
          comment: 'Same comment',
          localizations: {
            en: { value: 'Hello', state: 'new' },
            ja: { value: 'こんにちは', state: 'reviewed' },
          },
        },
      },
    });

    mergeDolphinJsons({ newJson, previousJson });
    expect(newJson.strings.key1.localizations.ja.state).toBe('new');
  });

  test('should set state to new json when comment changes', () => {
    const newJson = createBaseDolphinJson({
      strings: {
        key1: {
          comment: 'New comment',
          localizations: {
            en: { value: 'Hello', state: 'translated' },
            ja: { value: 'こんにちは', state: 'translated' },
          },
        },
      },
    });

    const previousJson = createBaseDolphinJson({
      strings: {
        key1: {
          comment: 'Old comment',
          localizations: {
            en: { value: 'Hello', state: 'translated' },
            ja: { value: 'こんにちは', state: 'reviewed' },
          },
        },
      },
    });

    mergeDolphinJsons({ newJson, previousJson });
    expect(newJson.strings.key1.localizations.ja.state).toBe('translated');
  });
});
