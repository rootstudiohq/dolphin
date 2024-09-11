import { logger } from '@repo/base/logger';
import fs from 'node:fs';
import path from 'node:path';

import {
  DolphinJSON,
  DolphinJSONLocalizationState,
  DolphinJSONStringUnitType,
} from '../../storage/index.js';
import { textHash } from '../../utils.js';
import { encodeXliffAttributeValue } from '../../xliff/index.js';
import { Unit, Xliff } from '../../xliff/xliff-spec.js';
import { ExportParser, XliffExportParser } from '../index.js';

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

export class XliffXCStringsParser implements XliffExportParser {
  async parse(
    filePath: string,
    language: string,
    sourceFilePath: string,
    sourceLanguage: string,
    basePath: string,
  ): Promise<Xliff> {
    const fileId = textHash(sourceFilePath);
    const xliffOriginalPath = path.relative(basePath, filePath);

    const fileContent = await fs.promises.readFile(filePath, 'utf-8');
    const xcstrings: XCStringsFile = parseXCStrings(fileContent);

    if (!xcstrings.strings) {
      logger.warn(`No strings in XCStrings file: ${filePath}`);
      return {
        name: 'xliff',
        type: 'element',
        attributes: {
          version: '2.0',
          srcLang: sourceLanguage,
          trgLang: language,
        },
        elements: [],
      };
    }

    const targetElements: Unit[] = [];

    // for (const [key, value] of Object.entries(xcstrings.strings)) {
    //   const comment = value.comment;
    //   if (!value.localizations) {
    //     const unitElements: Unit['elements'] = [];
    //     if (comment) {
    //       unitElements.push({
    //         name: 'notes',
    //         type: 'element',
    //         elements: [
    //           {
    //             name: 'note',
    //             type: 'element',
    //             elements: [
    //               {
    //                 type: 'text',
    //                 text: comment,
    //               },
    //             ],
    //           },
    //         ],
    //       });
    //     }
    //     unitElements.push({
    //       name: 'segment',
    //       type: 'element',
    //       attributes: {
    //         state: 'initial',
    //       },
    //       elements: [
    //         {
    //           name: 'source',
    //           type: 'element',
    //           elements: [
    //             {
    //               type: 'text',
    //               text: key,
    //             },
    //           ],
    //         },
    //       ],
    //     });
    //     targetElements.push({
    //       name: 'unit',
    //       type: 'element',
    //       attributes: {
    //         id: encodeXliffAttributeValue(`${key}-0`),
    //         extractionState: value.extractionState,
    //       },
    //       elements: unitElements,
    //     });
    //   } else {
    //     const sourceStringUnit =
    //       value.localizations[sourceLanguage]?.stringUnit;
    //     const sourceStringSet = value.localizations[sourceLanguage]?.stringSet;
    //     if (sourceStringSet) {
    //       const state =
    //         sourceStringSet.state === 'translated' ? 'translated' : 'initial';
    //       const targetStringSet = value.localizations[language]?.stringSet;
    //       if (sourceStringSet.values) {
    //         for (let i = 0; i < sourceStringSet.values.length; i++) {
    //           const sourceText = sourceStringSet.values[i];
    //           const targetText = targetStringSet?.values?.[i] || '';
    //           const unitElements: Unit['elements'] = [];
    //           if (comment) {
    //             unitElements.push({
    //               name: 'notes',
    //               type: 'element',
    //               elements: [
    //                 {
    //                   name: 'note',
    //                   type: 'element',
    //                   elements: [
    //                     {
    //                       type: 'text',
    //                       text: comment,
    //                     },
    //                   ],
    //                 },
    //               ],
    //             });
    //           }
    //           unitElements.push({
    //             name: 'segment',
    //             type: 'element',
    //             attributes: {
    //               state,
    //             },
    //             elements: [
    //               {
    //                 name: 'source',
    //                 type: 'element',
    //                 elements: [
    //                   {
    //                     type: 'text',
    //                     text: sourceText,
    //                   },
    //                 ],
    //               },
    //               {
    //                 name: 'target',
    //                 type: 'element',
    //                 elements: [
    //                   {
    //                     type: 'text',
    //                     text: targetText,
    //                   },
    //                 ],
    //               },
    //             ],
    //           });
    //           targetElements.push({
    //             name: 'unit',
    //             type: 'element',
    //             attributes: {
    //               id: encodeXliffAttributeValue(`${key}-${i}`),
    //               extractionState: value.extractionState,
    //             },
    //             elements: unitElements,
    //           });
    //         }
    //       }
    //     } else {
    //       const sourceText = sourceStringUnit?.value || key;
    //       const state =
    //         sourceStringUnit?.state === 'translated' ? 'translated' : 'initial';
    //       const targetStringUnit = value.localizations[language]?.stringUnit;
    //       const targetText = targetStringUnit?.value || '';
    //       const unitElements: Unit['elements'] = [];
    //       if (comment) {
    //         unitElements.push({
    //           name: 'notes',
    //           type: 'element',
    //           elements: [
    //             {
    //               name: 'note',
    //               type: 'element',
    //               elements: [
    //                 {
    //                   type: 'text',
    //                   text: comment,
    //                 },
    //               ],
    //             },
    //           ],
    //         });
    //       }
    //       unitElements.push({
    //         name: 'segment',
    //         type: 'element',
    //         attributes: {
    //           state,
    //         },
    //         elements: [
    //           {
    //             name: 'source',
    //             type: 'element',
    //             elements: [
    //               {
    //                 type: 'text',
    //                 text: sourceText,
    //               },
    //             ],
    //           },
    //           {
    //             name: 'target',
    //             type: 'element',
    //             elements: [
    //               {
    //                 type: 'text',
    //                 text: targetText,
    //               },
    //             ],
    //           },
    //         ],
    //       });
    //       targetElements.push({
    //         name: 'unit',
    //         type: 'element',
    //         attributes: {
    //           id: encodeXliffAttributeValue(`${key}-0`),
    //           extractionState: value.extractionState,
    //         },
    //         elements: unitElements,
    //       });
    //     }
    //   }
    // }

    return {
      name: 'xliff',
      type: 'element',
      attributes: {
        version: '2.0',
        srcLang: sourceLanguage,
        trgLang: language,
      },
      elements: [
        {
          name: 'file',
          type: 'element',
          attributes: {
            id: fileId,
            original: xliffOriginalPath,
          },
          elements: targetElements,
        },
      ],
    };
  }
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
      metadata: {},
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
            sourceValue: sourceValue,
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
              sourceValue: sourceValue,
            });
            continue;
          } else {
            this.updateTargetWithStringUnit({
              json: json,
              key: key,
              language: options.language,
              stringUnit: stringUnit,
              sourceValue: sourceValue,
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
    this.updateSourceWithValue({
      json: json,
      key: key,
      language: language,
      stringCatalogUnitType,
      comment: comment,
      extractionState: extractionState,
      shouldTranslate: shouldTranslate,
      state: stringUnit.state,
      value: stringUnit.value,
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
      sourceValue: sourceValue,
    });
  }

  private updateTargetWithValue(params: {
    json: DolphinJSON;
    key: string;
    language: string;
    shouldTranslate?: boolean;
    state?: string;
    value?: string;
    sourceValue?: string;
  }) {
    const { json, key, language, shouldTranslate, state, value, sourceValue } =
      params;
    const parsedState = this.parseState({
      state: state,
      default: value ? 'translated' : 'new',
    });
    const shouldSkip = shouldTranslate === false;
    json.strings[key].localizations[language] = {
      state: parsedState,
      skip: shouldSkip,
      metadata: {
        extractedFrom: value ? 'existing' : 'source',
        state: state,
      },
      value: value ?? sourceValue,
    };
  }

  private updateTargetWithStringUnit(params: {
    json: DolphinJSON;
    key: string;
    language: string;
    shouldTranslate?: boolean;
    stringUnit: XCStringsStringUnit;
    sourceValue?: string;
  }) {
    const { json, key, language, shouldTranslate, stringUnit, sourceValue } =
      params;
    console.log(
      `Updating target with string unit: ${key}, unit: ${JSON.stringify(
        stringUnit,
      )}`,
    );
    this.updateTargetWithValue({
      json: json,
      key: key,
      language: language,
      shouldTranslate: shouldTranslate,
      state: stringUnit.state,
      value: stringUnit.value,
      sourceValue: sourceValue,
    });
  }

  private parseState(options: {
    state?: string;
    default: DolphinJSONLocalizationState;
  }): DolphinJSONLocalizationState {
    if (!options.state) {
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
        return 'new';
    }
  }
}
