import { expect, test } from 'vitest';

import { createBatches } from '../batch.js';
import { LocalizationEntity } from '../entity.js';

const defaultConfig = {
  maxTokens: 4096,
  buffer: 0.2,
  tokenizer: 'openai' as const,
  tokenizerModel: 'gpt-4',
};

enum Source {
  Simple = 'Hello World', // 3 tokens
}

enum Note {
  Simple = 'simple entity', // 2 tokens
}

enum Key {
  Simple = 'simple', // 1 token
  Long = 'long', // 1 token
}

/*
// simple entity	// 3 = 1 + 2
"simple" = "hello world"	// 8 = 5 + 1 + 2

12 tokens = 3 + 8 + 1
*/

const simpleEntity = new LocalizationEntity({
  key: Key.Simple,
  sourceLanguage: 'en',
  unit: {
    localizations: {
      en: {
        state: 'translated',
        value: Source.Simple,
      },
      zh: {
        state: 'new',
      },
      ja: {
        state: 'new',
      },
    },
    comment: Note.Simple,
  },
});

test('empty entities', () => {
  expect(createBatches([], defaultConfig)).toStrictEqual([]);
});

test('one entity', () => {
  expect(createBatches([simpleEntity], defaultConfig)).toStrictEqual([
    {
      sourceLanguage: 'en',
      targetLanguages: ['ja', 'zh'],
      contents: [
        {
          key: Key.Simple,
          source: Source.Simple,
          notes: [Note.Simple],
        },
      ],
      expectedTokens: 8,
      sourceTokens: 12,
    },
  ]);
});

test('multiple entities', () => {
  const simple1 = Object.assign(
    Object.create(Object.getPrototypeOf(simpleEntity)),
    simpleEntity,
  );
  simple1.key = 'simple1';
  const simple2 = Object.assign(
    Object.create(Object.getPrototypeOf(simpleEntity)),
    simpleEntity,
  );
  simple2.key = 'simple2';
  const simple3 = Object.assign(
    Object.create(Object.getPrototypeOf(simpleEntity)),
    simpleEntity,
  );
  simple3.key = 'simple3';
  const simple4 = Object.assign(
    Object.create(Object.getPrototypeOf(simpleEntity)),
    simpleEntity,
  );
  simple4.key = 'simple4';
  expect(
    createBatches([simple1, simple2, simple3, simple4], defaultConfig),
  ).toStrictEqual([
    {
      sourceLanguage: 'en',
      targetLanguages: ['ja', 'zh'],
      contents: [
        {
          key: 'simple1',
          source: Source.Simple,
          notes: [Note.Simple],
        },
        {
          key: 'simple2',
          source: Source.Simple,
          notes: [Note.Simple],
        },
        {
          key: 'simple3',
          source: Source.Simple,
          notes: [Note.Simple],
        },
        {
          key: 'simple4',
          source: Source.Simple,
          notes: [Note.Simple],
        },
      ],
      expectedTokens: 63,
      sourceTokens: 52,
    },
  ]);
});

const longEntity = new LocalizationEntity({
  key: Key.Long,
  sourceLanguage: 'en',
  unit: {
    localizations: {
      en: {
        state: 'translated',
        value: Array(1000).fill(Source.Simple).join(' '),
      },
      zh: {
        state: 'new',
      },
      ja: {
        state: 'new',
      },
      ko: {
        state: 'new',
      },
      fr: {
        state: 'new',
      },
      de: {
        state: 'new',
      },
    },
    comment: Note.Simple,
  },
});

test('one long entity', () => {
  expect(createBatches([longEntity], defaultConfig)).toStrictEqual([
    {
      sourceLanguage: 'en',
      targetLanguages: ['de'],
      contents: [
        {
          key: Key.Long,
          source: Array(1000).fill(Source.Simple).join(' '),
          notes: [Note.Simple],
        },
      ],
      expectedTokens: 2006,
      sourceTokens: 3 + 5 + 1 + 2 * 1000 + 1,
    },
    {
      sourceLanguage: 'en',
      targetLanguages: ['fr'],
      contents: [
        {
          key: Key.Long,
          source: Array(1000).fill(Source.Simple).join(' '),
          notes: [Note.Simple],
        },
      ],
      expectedTokens: 2006,
      sourceTokens: 3 + 5 + 1 + 2 * 1000 + 1,
    },
    {
      sourceLanguage: 'en',
      targetLanguages: ['ja'],
      contents: [
        {
          key: Key.Long,
          source: Array(1000).fill(Source.Simple).join(' '),
          notes: [Note.Simple],
        },
      ],
      expectedTokens: 2006,
      sourceTokens: 3 + 5 + 1 + 2 * 1000 + 1,
    },
    {
      sourceLanguage: 'en',
      targetLanguages: ['ko'],
      contents: [
        {
          key: Key.Long,
          source: Array(1000).fill(Source.Simple).join(' '),
          notes: [Note.Simple],
        },
      ],
      expectedTokens: 2006,
      sourceTokens: 3 + 5 + 1 + 2 * 1000 + 1,
    },
    {
      sourceLanguage: 'en',
      targetLanguages: ['zh'],
      contents: [
        {
          key: Key.Long,
          source: Array(1000).fill(Source.Simple).join(' '),
          notes: [Note.Simple],
        },
      ],
      expectedTokens: 2006,
      sourceTokens: 3 + 5 + 1 + 2 * 1000 + 1,
    },
  ]);
});

const tooLongEntity = new LocalizationEntity({
  key: Key.Long,
  sourceLanguage: 'en',
  unit: {
    localizations: {
      en: {
        state: 'translated',
        value: Array(3000).fill(Source.Simple).join(' '),
      },
      zh: {
        state: 'new',
      },
      ja: {
        state: 'new',
      },
      ko: {
        state: 'new',
      },
      fr: {
        state: 'new',
      },
      de: {
        state: 'new',
      },
    },
    comment: Note.Simple,
  },
});

test('one too long entity', () => {
  expect(() => createBatches([tooLongEntity], defaultConfig)).toThrowError(
    'too long',
  );
});
