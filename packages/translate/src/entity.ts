import { logger } from '@repo/base/logger';
import { textHash } from '@repo/ioloc';
import {
  Group,
  Notes,
  Segment,
  Source,
  Target,
  Unit,
  Xliff,
  parseXliff2Path,
  stringifyXliff2,
  textAsTextElementOrInline,
} from '@repo/ioloc/xliff';
import { elementAsText } from '@repo/ioloc/xliff';
import fs from 'node:fs';

export type LocalizationEntityDictionary = {
  [key: string]: LocalizationEntity;
};

export const LOCALITION_REVIEW_SUBSTATE_DECLINED = 'dolphin_review_declined';

export const LOCALITION_REVIEW_SUBSTATE_REFINE_NEEDED =
  'dolphin_review_refine_needed';

export const LOCALIZATION_STATE_INITIAL = 'initial';

export const LOCALIZATION_STATE_TRANSLATED = 'translated';

export const LOCALIZATION_STATE_REVIEWED = 'reviewed';

export const LOCALIZATION_STATE_FINAL = 'final';

export type LocalizationTarget = {
  value?: string;
  state?: 'initial' | 'translated' | 'reviewed' | 'final';
  subState?: string;
  notes: string[]; // Commnet/note for translators
};

export class LocalizationEntity {
  key: string;
  keyPaths: string[];
  source: {
    code: string;
    value: string;
  }; // string to be translated
  target: {
    [language: string]: LocalizationTarget | undefined;
  }; // translated strings

  constructor({
    key,
    keyPaths,
    source,
    target,
  }: {
    key: string;
    keyPaths: string[];
    source: {
      code: string;
      value: string;
    };
    target: {
      [language: string]: LocalizationTarget | undefined;
    };
  }) {
    this.key = key;
    this.keyPaths = keyPaths;
    this.source = source;
    this.target = target;
  }

  get targetLanguages(): string[] {
    return Object.keys(this.target);
  }

  get needsReview(): boolean {
    const skipReview = this.targetLanguages.every((lang) => {
      const target = this.target[lang]!;
      return this.isTargetFinal(target);
    });
    return !skipReview;
  }

  get untranslatedLanguages(): string[] {
    const unstranslated = this.targetLanguages.filter((lang) => {
      const target = this.target[lang]!;
      return !this.isTranslated(target);
    });
    return unstranslated.sort();
  }

  get allNotes(): string[] {
    return [
      ...new Set(this.targetLanguages.flatMap((t) => this.target[t]!.notes)),
    ];
  }

  get isFinal(): boolean {
    return this.targetLanguages.every((lang) => {
      const target = this.target[lang]!;
      return this.isTargetFinal(target);
    });
  }

  get isAllTranslated(): boolean {
    return this.targetLanguages.every((lang) => {
      const target = this.target[lang]!;
      return this.isTranslated(target);
    });
  }

  isTargetFinal(target: LocalizationTarget): boolean {
    return target.state === LOCALIZATION_STATE_FINAL;
  }

  isTranslated(target: LocalizationTarget): boolean {
    if (this.isTargetFinal(target)) {
      return true;
    }
    if (
      target.state === LOCALIZATION_STATE_TRANSLATED ||
      target.state === LOCALIZATION_STATE_REVIEWED
    ) {
      return true;
    }
    return false;
  }

  updateState(
    state: 'initial' | 'translated' | 'reviewed' | 'final',
    subState?: string,
  ) {
    for (const lang in this.target) {
      this.target[lang]!.state = state;
      if (subState) {
        this.target[lang]!.subState = subState;
      }
    }
  }

  addNotes(notes: string[]) {
    for (const lang in this.target) {
      this.target[lang]!.notes = [
        ...new Set([...this.target[lang]!.notes, ...notes]),
      ];
    }
  }
}

export function entityKeyHash(keys: string[]): string {
  const hashed = textHash(keys.map((x) => encodeURIComponent(x)).join('&'));
  return hashed.slice(0, 6);
}

export function convertXliffsToEntities(
  xliffs: Xliff<any>[],
): LocalizationEntityDictionary {
  let strings: LocalizationEntityDictionary = {};
  for (const xliff of xliffs) {
    const sourceLanguage = xliff.attributes.srcLang;
    const targetLanguage = xliff.attributes.trgLang;
    if (!targetLanguage) {
      throw new Error(`Cannot merge file without target language.`);
    }
    for (const file of xliff.elements || []) {
      const startKeys = [sourceLanguage, file.attributes.id];
      for (const element of file.elements || []) {
        const entities = convertXliffElementToEntities(
          element,
          sourceLanguage,
          targetLanguage,
          startKeys,
        );
        for (const entity of entities) {
          const existing = strings[entity.key];
          if (existing) {
            for (const lang in entity.target) {
              existing.target[lang] = entity.target[lang]!;
            }
          } else {
            strings[entity.key] = entity;
          }
        }
      }
    }
  }
  return strings;
}

function convertXliffElementToEntities(
  element: Group | Unit,
  sourceLanguage: string,
  targetLanguage: string,
  parentKeys: string[],
): LocalizationEntity[] {
  if (element.name === 'group') {
    const keys = [...parentKeys, element.attributes.id];
    const elements = element.elements || [];
    const unitsOrGroups = elements.filter(
      (e) => e.name === 'unit' || e.name === 'group',
    ) as (Unit | Group)[];
    return unitsOrGroups.flatMap((e) =>
      convertXliffElementToEntities(e, sourceLanguage, targetLanguage, keys),
    );
  } else if (element.name === 'unit') {
    const keys = [...parentKeys, element.attributes.id];
    const key = entityKeyHash(keys);
    const elements = element.elements || [];
    const notesElements = elements.filter((e) => e.name === 'notes') as Notes[];
    const notes = notesElements.flatMap((note) => {
      return note.elements.flatMap((e) => {
        return e.elements.map((e) => e.text);
      });
    });
    const segment = elements.find((e) => e.name === 'segment') as
      | Segment
      | undefined;
    if (!segment) {
      logger.warn(`No segment for element: ${element.attributes.id}`);
      return [];
    }
    const source = segment.elements.find((e) => e.name === 'source') as
      | Source
      | undefined;
    if (!source) {
      logger.warn(`No source for element: ${element.attributes.id}`);
      return [];
    }
    const target = segment.elements.find((e) => e.name === 'target') as
      | Target
      | undefined;
    let entity = new LocalizationEntity({
      key,
      keyPaths: keys,
      source: {
        code: sourceLanguage,
        value: elementAsText(source),
      },
      target: target
        ? {
            [targetLanguage]: {
              value: elementAsText(target),
              state: segment.attributes?.state,
              subState: segment.attributes?.subState,
              notes,
            },
          }
        : { [targetLanguage]: { notes: [] } },
    });
    return [entity];
  } else {
    return [];
  }
}

export async function mergePreviousTranslatedXliff(
  xliffPath: string,
  previousXliffFilePath: string,
) {
  const xliff = await parseXliff2Path(xliffPath);
  const newStrings = convertXliffsToEntities([xliff.elements[0]]);
  if (!fs.existsSync(previousXliffFilePath)) {
    return;
  }
  const previousXliff = await parseXliff2Path(previousXliffFilePath);
  const previousStrings = convertXliffsToEntities([previousXliff.elements[0]]);
  for (const key in newStrings) {
    const newString = newStrings[key]!;
    const previous = previousStrings[key];
    if (!previous) {
      continue;
    }
    for (const targetLanguage in newString.target) {
      const currentTarget = newString.target[targetLanguage]!;
      if (currentTarget.state !== LOCALIZATION_STATE_INITIAL) {
        continue;
      }
      const previousTarget = previous.target[targetLanguage];
      if (!previousTarget) {
        continue;
      }
      // make sure source is identical
      if (
        previous.source.code !== newString.source.code ||
        previous.source.value !== newString.source.value
      ) {
        continue;
      }
      // make sure notes are identical
      if (
        currentTarget.notes.length !== previousTarget.notes.length ||
        !currentTarget.notes.every(
          (value, index) => value === previousTarget.notes[index],
        )
      ) {
        continue;
      }
      // If previous is translated, use previous translation
      if (previousTarget.state !== LOCALIZATION_STATE_INITIAL) {
        newString.target[targetLanguage] = previousTarget;
      }
    }
  }
  writeTranslatedStringsToExistingFile(newStrings, xliffPath);
}

export async function writeTranslatedStringsToExistingFile(
  translatedStrings: LocalizationEntityDictionary,
  filePath: string,
) {
  const doc = await parseXliff2Path(filePath);
  const xliff = doc.elements[0];
  if (!xliff) {
    return;
  }
  await updateTranslatedStrings(translatedStrings, xliff);
  const xml = stringifyXliff2(doc);
  await fs.promises.writeFile(filePath, xml);
}

export async function updateTranslatedStrings(
  translatedStrings: LocalizationEntityDictionary,
  xliff: Xliff,
) {
  const sourceLanguage = xliff.attributes.srcLang;
  const targetLanguage = xliff.attributes.trgLang;
  if (!targetLanguage) {
    logger.error(`Cannot merge file without a target language.`);
    return;
  }
  if (!xliff.elements) {
    return;
  }
  xliff.elements.map((file) => {
    const startKeys = [sourceLanguage, file.attributes.id];
    file.elements = (file.elements || []).map((element) => {
      if (element.name === 'unit' || element.name === 'group') {
        return updateTranslatedElement(
          translatedStrings,
          element,
          sourceLanguage,
          targetLanguage,
          startKeys,
        );
      } else {
        return element;
      }
    });
    return file;
  });
  return xliff;
}

function updateTranslatedElement(
  translatedStrings: LocalizationEntityDictionary,
  element: Group | Unit,
  sourceLanguage: string,
  targetLanguage: string,
  parentKeys: string[],
): Group | Unit {
  if (element.name === 'group') {
    const keys = [...parentKeys, element.attributes.id];
    element.elements = element.elements?.map((e) => {
      if (e.name === 'group' || e.name === 'unit') {
        return updateTranslatedElement(
          translatedStrings,
          e,
          sourceLanguage,
          targetLanguage,
          keys,
        );
      } else {
        return e;
      }
    });
  } else if (element.name === 'unit') {
    const keys = [...parentKeys, element.attributes.id];
    const key = entityKeyHash(keys);
    element.elements = element.elements?.map((element) => {
      if (element.name === 'segment') {
        const elementStrings = translatedStrings[key];
        if (!elementStrings || !elementStrings.target) {
          return element;
        }
        const translated = elementStrings.target[targetLanguage];
        if (!translated || !translated.value) {
          return element;
        }
        let source = element.elements.find((e) => e.name === 'source') as
          | Source
          | undefined;
        if (!source) {
          logger.warn(`No source for segment element`);
          source = {
            name: 'source',
            type: 'element',
            elements: textAsTextElementOrInline(elementStrings.source.value),
          };
        }
        let target = element.elements.find((e) => e.name === 'target') as
          | Target
          | undefined;
        if (target) {
          target.elements = textAsTextElementOrInline(translated.value);
        } else {
          target = {
            name: 'target',
            type: 'element',
            elements: textAsTextElementOrInline(translated.value),
          };
        }
        if (translated.state || translated.subState) {
          if (!element.attributes) {
            element.attributes = {};
          }
          element.attributes.state = translated.state;
          element.attributes.subState = translated.subState;
        }
        element.elements = [source, target];
        return element;
      } else if (element.name === 'notes') {
        const elementStrings = translatedStrings[key];
        if (!elementStrings || !elementStrings.target) {
          return element;
        }
        const translated = elementStrings.target[targetLanguage];
        if (!translated) {
          return element;
        }
        element.elements = translated.notes.map((note) => {
          return {
            name: 'note',
            type: 'element',
            elements: [
              {
                type: 'text',
                text: note,
              },
            ],
          };
        });
        return element;
      } else {
        return element;
      }
    });
  }
  return element;
}
