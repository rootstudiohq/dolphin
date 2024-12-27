import { writeFile } from '@repo/base/utils';

import { XCStringsFile } from '../../export/parser/xcstrings.js';
import { DolphinJSON } from '../../storage/index.js';
import { ImportMerger } from '../basic.js';
import { getTargetValue } from './common.js';

export class XCStringsMerger implements ImportMerger {
  async merge(options: {
    json: DolphinJSON;
    sourceFilePath: string;
    targetLanguage: string;
    targetFilePath: string;
  }): Promise<void> {
    const { json, targetLanguage, targetFilePath } = options;

    // Create a new XCStrings file
    const xcstrings: XCStringsFile = {
      sourceLanguage: json.sourceLanguage,
      version: '1.0',
      strings: {},
    };

    // Update the XCStrings file with translations
    for (const [key, value] of Object.entries(json.strings)) {
      const targetValue = getTargetValue({
        json,
        targetLanguage,
        key,
      });
      if (targetValue === undefined) {
        continue;
      }

      // Add base properties for the string
      if (!xcstrings.strings[key]) {
        xcstrings.strings[key] = {};
      }

      // Add string properties
      if (value.comment) {
        xcstrings.strings[key].comment = value.comment;
      }
      if (value.metadata?.extractionState) {
        xcstrings.strings[key].extractionState = value.metadata.extractionState;
      }
      if (value.metadata?.shouldTranslate !== undefined) {
        xcstrings.strings[key].shouldTranslate = value.metadata.shouldTranslate;
      }

      const unitType = value.metadata?.stringCatalogUnitType;
      if (unitType === 'stringUnit') {
        this.updateStringUnit({
          xcstrings,
          key,
          targetLanguage,
          value: targetValue,
        });
      } else if (unitType === 'stringSet') {
        this.updateStringSet({
          xcstrings,
          key,
          targetLanguage,
          value: targetValue,
        });
      } else if (unitType === 'variations') {
        this.updateVariations({
          xcstrings,
          key,
          targetLanguage,
          value: targetValue,
        });
      }
    }

    // Write the updated XCStrings file
    await writeFile(targetFilePath, JSON.stringify(xcstrings, null, 2));
  }

  private updateStringUnit(params: {
    xcstrings: XCStringsFile;
    key: string;
    targetLanguage: string;
    value: string;
  }) {
    const { xcstrings, key, targetLanguage, value } = params;

    if (!xcstrings.strings[key]) {
      xcstrings.strings[key] = {};
    }

    if (!xcstrings.strings[key].localizations) {
      xcstrings.strings[key].localizations = {};
    }

    xcstrings.strings[key].localizations![targetLanguage] = {
      stringUnit: {
        state: 'translated',
        value: value,
      },
    };
  }

  private updateStringSet(params: {
    xcstrings: XCStringsFile;
    key: string;
    targetLanguage: string;
    value: string;
  }) {
    const { xcstrings, key, targetLanguage, value } = params;

    // Extract original key and index from the encoded key
    const [encodedOriginalKey, indexStr] = key.split('/');
    const originalKey = decodeURIComponent(encodedOriginalKey);
    const index = parseInt(indexStr, 10);

    if (!xcstrings.strings[originalKey]) {
      xcstrings.strings[originalKey] = {};
    }

    if (!xcstrings.strings[originalKey].localizations) {
      xcstrings.strings[originalKey].localizations = {};
    }

    const localization =
      xcstrings.strings[originalKey].localizations![targetLanguage];
    if (!localization || !('stringSet' in localization)) {
      xcstrings.strings[originalKey].localizations![targetLanguage] = {
        stringSet: {
          state: 'translated',
          values: [],
        },
      };
    }

    const stringSet = (
      xcstrings.strings[originalKey].localizations![targetLanguage] as any
    ).stringSet;
    if (!stringSet.values) {
      stringSet.values = [];
    }
    stringSet.values[index] = value;
  }

  private updateVariations(params: {
    xcstrings: XCStringsFile;
    key: string;
    targetLanguage: string;
    value: string;
  }) {
    const { xcstrings, key, targetLanguage, value } = params;

    // Extract original key and device from the encoded key
    const [encodedOriginalKey, device] = key.split('/');
    const originalKey = decodeURIComponent(encodedOriginalKey);

    if (!xcstrings.strings[originalKey]) {
      xcstrings.strings[originalKey] = {};
    }

    if (!xcstrings.strings[originalKey].localizations) {
      xcstrings.strings[originalKey].localizations = {};
    }

    xcstrings.strings[originalKey].localizations![targetLanguage] = {
      variations: {
        device: {
          [device]: {
            stringUnit: {
              state: 'translated',
              value: value,
            },
          },
        },
      },
    };
  }
}
