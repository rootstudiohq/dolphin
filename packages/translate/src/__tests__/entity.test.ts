import { DolphinJSONStringUnit } from '@repo/ioloc/storage';
import { describe, expect, it } from 'vitest';

import { LocalizationEntity } from '../entity.js';

describe('LocalizationEntity', () => {
  const createMockUnit = (overrides = {}): DolphinJSONStringUnit => ({
    localizations: {
      en: { value: 'Hello', state: 'new' },
      ja: { value: 'こんにちは', state: 'new' },
      fr: { value: 'Bonjour', state: 'new' },
    },
    comment: 'Test comment',
    metadata: {
      additionalComments: ['Additional note'],
    },
    ...overrides,
  });

  describe('constructor and basic properties', () => {
    it('should create an instance with correct properties', () => {
      const unit = createMockUnit();
      const entity = new LocalizationEntity({
        key: 'greeting',
        sourceLanguage: 'en',
        unit,
      });

      expect(entity.key).toBe('greeting');
      expect(entity.sourceLanguage).toBe('en');
      expect(entity.unit).toBe(unit);
    });
  });

  describe('sourceText', () => {
    it('should return source text correctly', () => {
      const entity = new LocalizationEntity({
        key: 'greeting',
        sourceLanguage: 'en',
        unit: createMockUnit(),
      });

      expect(entity.sourceText).toBe('Hello');
    });

    it('should throw error if source language not found', () => {
      const entity = new LocalizationEntity({
        key: 'greeting',
        sourceLanguage: 'es',
        unit: createMockUnit(),
      });

      expect(() => entity.sourceText).toThrow('Source language es not found');
    });

    it('should throw error if source value not found', () => {
      const unit = createMockUnit({
        localizations: {
          en: { state: 'new' },
        },
      });
      const entity = new LocalizationEntity({
        key: 'greeting',
        sourceLanguage: 'en',
        unit,
      });

      expect(() => entity.sourceText).toThrow(
        'Source value not found for greeting',
      );
    });
  });

  describe('targetLanguages', () => {
    it('should return all languages except source language', () => {
      const entity = new LocalizationEntity({
        key: 'greeting',
        sourceLanguage: 'en',
        unit: createMockUnit(),
      });

      expect(new Set(entity.targetLanguages)).toEqual(new Set(['fr', 'ja']));
    });
  });

  describe('translation states', () => {
    it('should correctly identify untranslated languages', () => {
      const unit = createMockUnit({
        localizations: {
          en: { value: 'Hello', state: 'new' },
          ja: { value: 'こんにちは', state: 'translated' },
          fr: { value: 'Bonjour', state: 'new' },
        },
      });
      const entity = new LocalizationEntity({
        key: 'greeting',
        sourceLanguage: 'en',
        unit,
      });

      expect(entity.untranslatedLanguages).toEqual(['fr']);
    });

    it('should correctly check if all translations are final', () => {
      const unit = createMockUnit({
        localizations: {
          en: { value: 'Hello', state: 'new' },
          ja: { value: 'こんにちは', state: 'reviewed' },
          fr: { value: 'Bonjour', state: 'reviewed' },
        },
      });
      const entity = new LocalizationEntity({
        key: 'greeting',
        sourceLanguage: 'en',
        unit,
      });

      expect(entity.isFinal).toBe(true);
    });

    it('should correctly check if all languages are translated', () => {
      const unit = createMockUnit({
        localizations: {
          en: { value: 'Hello', state: 'new' },
          ja: { value: 'こんにちは', state: 'translated' },
          fr: { value: 'Bonjour', state: 'reviewed' },
        },
      });
      const entity = new LocalizationEntity({
        key: 'greeting',
        sourceLanguage: 'en',
        unit,
      });

      expect(entity.isAllTranslated).toBe(true);
    });

    describe('needsReview', () => {
      it('should return true when translations need review', () => {
        const unit = createMockUnit({
          localizations: {
            en: { value: 'Hello', state: 'translated' },
            ja: { value: 'こんにちは', state: 'translated' },
            fr: { value: 'Bonjour', state: 'new' },
          },
        });
        const entity = new LocalizationEntity({
          key: 'greeting',
          sourceLanguage: 'en',
          unit,
        });

        expect(entity.needsReview).toBe(true);
      });

      it('should return false when all translations are in final state', () => {
        const unit = createMockUnit({
          localizations: {
            en: { value: 'Hello', state: 'reviewed' },
            ja: { value: 'こんにちは', state: 'reviewed' },
            fr: { value: 'Bonjour', state: 'reviewed' },
          },
        });
        const entity = new LocalizationEntity({
          key: 'greeting',
          sourceLanguage: 'en',
          unit,
        });

        expect(entity.needsReview).toBe(false);
      });

      it('should return true when all translations are rejected', () => {
        const unit = createMockUnit({
          localizations: {
            en: { value: 'Hello', state: 'rejected' },
            ja: { value: 'こんにちは', state: 'rejected' },
            fr: { value: 'Bonjour', state: 'rejected' },
          },
        });
        const entity = new LocalizationEntity({
          key: 'greeting',
          sourceLanguage: 'en',
          unit,
        });

        expect(entity.needsReview).toBe(true);
      });

      it('should return true when some translations are not in final state', () => {
        const unit = createMockUnit({
          localizations: {
            en: { value: 'Hello', state: 'translated' },
            ja: { value: 'こんにちは', state: 'reviewed' },
            fr: { value: 'Bonjour', state: 'review_skipped' },
          },
        });
        const entity = new LocalizationEntity({
          key: 'greeting',
          sourceLanguage: 'en',
          unit,
        });

        expect(entity.needsReview).toBe(true);
      });
    });
  });

  describe('comments', () => {
    it('should return all comments', () => {
      const entity = new LocalizationEntity({
        key: 'greeting',
        sourceLanguage: 'en',
        unit: createMockUnit(),
      });

      expect(new Set(entity.allComments)).toEqual(
        new Set(['Test comment', 'Additional note']),
      );
    });

    it('should add additional comments', () => {
      const entity = new LocalizationEntity({
        key: 'greeting',
        sourceLanguage: 'en',
        unit: createMockUnit(),
      });

      entity.addAdditionalComments(['New comment']);
      expect(new Set(entity.allComments)).toEqual(
        new Set(['Test comment', 'Additional note', 'New comment']),
      );
    });
  });

  describe('updateState', () => {
    it('should update state for all localizations', () => {
      const entity = new LocalizationEntity({
        key: 'greeting',
        sourceLanguage: 'en',
        unit: createMockUnit(),
      });

      entity.updateState('translated', 'approved');

      expect(entity.unit.localizations.en.state).toBe('translated');
      expect(entity.unit.localizations.ja.state).toBe('translated');
      expect(entity.unit.localizations.fr.state).toBe('translated');
      expect(entity.unit.metadata?.reviewResult).toBe('approved');
    });
  });
});
