import { logger } from '@repo/base/logger';

import {
  DolphinJSON,
  DolphinJSONLocalizationState,
  DolphinJSONStringUnitType,
} from '../../storage/index.js';
import { ExportParser } from '../index.js';

interface XCStringsStringUnit {
  state?: string; // known state: "new", "translated"
  value?: string;
}

export interface XCStringsFile {
  sourceLanguage: string;
  strings: {
    [key: string]: {
      extractionState?: string; // known state: "extracted_with_value", "manual"
      comment?: string;
      shouldTranslate?: boolean;
      localizations?: {
        [lang: string]:
          | {
              stringUnit: XCStringsStringUnit;
            }
          | {
              stringSet: {
                state?: string; // known state: "translated", "new", "needs_review"
                values?: string[];
              };
            }
          | {
              variations: {
                device: {
                  [device: string]: {
                    stringUnit: XCStringsStringUnit;
                  };
                };
              };
            };
      };
    };
  };
  version: string;
}

export function parseXCStrings(content: string): XCStringsFile {
  try {
    const parsed: XCStringsFile = JSON.parse(content);
    // Add validation logic here if needed
    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse XCStrings file: ${error}`);
  }
}

/**
 * StringCatalogParser is a parser for Apple strings catalog files (.xcstrings). Internally, it's a predefined json format.
 * Each file represents one language, and have a structure like:
 *
 * [en].xcstrings:
 * {
 *   "Home Title": "Home",
 *   "Welcome Description": "Welcome to our home page"
 * }
 */
export class StringCatalogParser implements ExportParser {
  async exportSource(options: {
    fileId: string;
    content: string;
    language: string;
  }): Promise<DolphinJSON> {
    const json: DolphinJSON = {
      version: '1.0',
      fileId: options.fileId,
      sourceLanguage: options.language,
      metadata: {
        format: 'stringCatalog',
      },
      strings: {},
    };

    const xcstrings: XCStringsFile = parseXCStrings(options.content);
    if (!xcstrings.strings) {
      logger.warn(`No strings in string catalog file`);
      return json;
    }

    for (const [key, value] of Object.entries(xcstrings.strings)) {
      const localizations = value.localizations;
      const comment = value.comment;
      const extractionState = value.extractionState;
      if (!localizations || !localizations[options.language]) {
        this.updateSourceWithEmpty({
          json: json,
          key: key,
          language: options.language,
          stringCatalogUnitType: 'stringUnit',
          comment: comment,
          extractionState: extractionState,
          shouldTranslate: value.shouldTranslate,
        });
        continue;
      }

      const localization = localizations[options.language];
      if ('stringUnit' in localization) {
        const stringUnit = localization.stringUnit;
        this.updateSourceWithStringUnit({
          json: json,
          key: key,
          language: options.language,
          stringCatalogUnitType: 'stringUnit',
          comment: comment,
          extractionState: extractionState,
          shouldTranslate: value.shouldTranslate,
          stringUnit: stringUnit,
        });
      } else if ('stringSet' in localization) {
        const stringSet = localization.stringSet;
        if (!stringSet.values) {
          const stringKey = `${encodeURIComponent(key)}/${0}`;
          this.updateSourceWithValue({
            json: json,
            key: stringKey,
            language: options.language,
            stringCatalogUnitType: 'stringSet',
            comment: comment,
            extractionState: extractionState,
            shouldTranslate: value.shouldTranslate,
            state: stringSet.state,
            value: undefined,
          });
          continue;
        }
        for (let i = 0; i < stringSet.values.length; i++) {
          const stringKey = `${encodeURIComponent(key)}/${i}`;
          this.updateSourceWithValue({
            json: json,
            key: stringKey,
            language: options.language,
            stringCatalogUnitType: 'stringSet',
            comment: comment,
            extractionState: extractionState,
            shouldTranslate: value.shouldTranslate,
            state: stringSet.state,
            value: stringSet.values[i],
          });
        }
      } else if ('variations' in localization) {
        const variations = localization.variations;
        for (const [device, deviceVariations] of Object.entries(
          variations.device,
        )) {
          const stringUnit = deviceVariations.stringUnit;
          const encodedKey = `${encodeURIComponent(key)}/${device}`;
          this.updateSourceWithStringUnit({
            json: json,
            key: encodedKey,
            language: options.language,
            stringCatalogUnitType: 'variations',
            stringUnit: stringUnit,
            comment: comment,
            extractionState: extractionState,
            shouldTranslate: value.shouldTranslate,
          });
        }
      } else {
        throw new Error(
          `Unknown localization type: ${JSON.stringify(localization)}`,
        );
      }
    }
    return json;
  }

  async exportTarget(options: {
    fileId: string;
    content?: string;
    language: string;
    json: DolphinJSON;
  }): Promise<DolphinJSON> {
    const json = options.json;
    if (!options.content) {
      return json;
    }

    const xcstrings: XCStringsFile = parseXCStrings(options.content);
    for (const key in json.strings) {
      const value = json.strings[key];
      const sourceValue = value.localizations[options.language]?.value;
      const unitType = value.metadata?.stringCatalogUnitType ?? 'stringUnit';
      if (unitType === 'stringUnit') {
        const localization =
          xcstrings.strings[key]?.localizations?.[options.language];
        if (localization && 'stringUnit' in localization) {
          this.updateTargetWithStringUnit({
            json: json,
            key: key,
            language: options.language,
            stringUnit: localization.stringUnit,
          });
        } else {
          this.updateTargetWithEmpty({
            json: json,
            key: key,
            language: options.language,
            sourceValue: sourceValue,
          });
        }
      } else if (unitType === 'stringSet') {
        const keyParts = key.split('/');
        if (keyParts.length !== 2) {
          throw new Error(
            `Invalid key format: ${key}, can't extract stringSet index`,
          );
        }
        const decodedKey = decodeURIComponent(keyParts[0]);
        const index = parseInt(keyParts[1], 10);
        const localization =
          xcstrings.strings[decodedKey]?.localizations?.[options.language];
        if (localization && 'stringSet' in localization) {
          const state = localization.stringSet.state;
          const existingValue = localization.stringSet.values?.[index];
          const parsedState = this.parseState({
            state: state,
            default: existingValue ? 'translated' : 'new',
          });
          json.strings[key].localizations[options.language] = {
            state: parsedState,
            metadata: {
              extractedFrom: 'existing',
              state: state,
            },
            value: existingValue ?? sourceValue,
          };
        } else {
          this.updateTargetWithEmpty({
            json: json,
            key: key,
            language: options.language,
            sourceValue: sourceValue,
          });
        }
      } else if (unitType === 'variations') {
        const keyParts = key.split('/');
        if (keyParts.length !== 2) {
          throw new Error(
            `Invalid key format: ${key}, can't extract variations device`,
          );
        }
        const decodedKey = decodeURIComponent(keyParts[0]);
        const device = keyParts[1];
        const localization =
          xcstrings.strings[decodedKey]?.localizations?.[options.language];
        if (localization && 'variations' in localization) {
          const stringUnit: XCStringsStringUnit | undefined =
            localization.variations.device[device]?.stringUnit;
          if (!stringUnit) {
            this.updateTargetWithEmpty({
              json: json,
              key: key,
              language: options.language,
            });
            continue;
          } else {
            this.updateTargetWithStringUnit({
              json: json,
              key: key,
              language: options.language,
              stringUnit: stringUnit,
            });
          }
        } else {
          this.updateTargetWithEmpty({
            json: json,
            key: key,
            language: options.language,
            sourceValue: sourceValue,
          });
        }
      } else {
        throw new Error(
          `Unknown unit type: ${value.metadata?.stringCatalogUnitType}`,
        );
      }
    }
    return json;
  }

  private updateSourceWithStringUnit(params: {
    json: DolphinJSON;
    key: string;
    language: string;
    stringCatalogUnitType: DolphinJSONStringUnitType;
    comment?: string;
    extractionState?: string;
    shouldTranslate?: boolean;
    stringUnit: XCStringsStringUnit;
  }) {
    const {
      json,
      key,
      language,
      stringCatalogUnitType,
      comment,
      extractionState,
      shouldTranslate,
      stringUnit,
    } = params;
    // if no value found, use the key as the value
    const value = stringUnit.value ?? key;
    this.updateSourceWithValue({
      json: json,
      key: key,
      language: language,
      stringCatalogUnitType,
      comment: comment,
      extractionState: extractionState,
      shouldTranslate: shouldTranslate,
      state: stringUnit.state,
      value: value,
    });
  }

  private updateSourceWithEmpty(params: {
    json: DolphinJSON;
    key: string;
    language: string;
    stringCatalogUnitType: DolphinJSONStringUnitType;
    comment?: string;
    extractionState?: string;
    shouldTranslate?: boolean;
    sourceValue?: string;
  }) {
    const {
      json,
      key,
      language,
      sourceValue,
      stringCatalogUnitType,
      comment,
      extractionState,
      shouldTranslate,
    } = params;
    this.updateSourceWithValue({
      json: json,
      key: key,
      language: language,
      stringCatalogUnitType,
      comment: comment,
      extractionState: extractionState,
      shouldTranslate: shouldTranslate,
      value: sourceValue,
    });
  }

  private updateSourceWithValue(params: {
    json: DolphinJSON;
    key: string;
    language: string;
    stringCatalogUnitType: DolphinJSONStringUnitType;
    comment?: string;
    extractionState?: string;
    shouldTranslate?: boolean;
    state?: string;
    value?: string;
  }) {
    const {
      json,
      key,
      language,
      comment,
      extractionState,
      shouldTranslate,
      state,
      value,
      stringCatalogUnitType,
    } = params;
    const shouldSkip = shouldTranslate === false;
    json.strings[key] = {
      comment: comment,
      metadata: {
        shouldTranslate: shouldTranslate,
        stringCatalogUnitType,
        extractionState: extractionState,
      },
      localizations: {
        [language]: {
          state: 'new',
          skip: shouldSkip,
          metadata: {
            extractedFrom: 'source',
            state: state,
          },
          value: value,
        },
      },
    };
  }

  private updateTargetWithEmpty(params: {
    json: DolphinJSON;
    key: string;
    language: string;
    sourceValue?: string;
  }) {
    const { json, key, language, sourceValue } = params;
    this.updateTargetWithValue({
      json: json,
      key: key,
      language: language,
    });
  }

  private updateTargetWithValue(params: {
    json: DolphinJSON;
    key: string;
    language: string;
    shouldTranslate?: boolean;
    state?: string;
    value?: string;
  }) {
    const { json, key, language, shouldTranslate, state, value } = params;
    const parsedState = this.parseState({
      state: state,
      default: value !== undefined ? 'translated' : 'new',
    });
    const shouldSkip = shouldTranslate === false;
    json.strings[key].localizations[language] = {
      state: parsedState,
      skip: shouldSkip,
      metadata: {
        extractedFrom: value !== undefined ? 'existing' : 'undefined',
        state: state,
      },
      value: value,
    };
  }

  private updateTargetWithStringUnit(params: {
    json: DolphinJSON;
    key: string;
    language: string;
    shouldTranslate?: boolean;
    stringUnit: XCStringsStringUnit;
  }) {
    const { json, key, language, shouldTranslate, stringUnit } = params;
    this.updateTargetWithValue({
      json: json,
      key: key,
      language: language,
      shouldTranslate: shouldTranslate,
      state: stringUnit.state,
      value: stringUnit.value,
    });
  }

  private parseState(options: {
    state?: string;
    default: DolphinJSONLocalizationState;
  }): DolphinJSONLocalizationState {
    if (options.state === undefined) {
      return options.default;
    }
    switch (options.state) {
      case 'new':
        return 'new';
      case 'translated':
        return 'translated';
      case 'needs_review':
        return 'translated';
      default:
        throw new Error(
          `Unknown state for string catalog unit: ${options.state}. Please submit an issue or PR.`,
        );
    }
  }
}
