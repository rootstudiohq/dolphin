import { logger } from '@repo/base/logger';

import { XliffVersion, parseXliffText } from '../../common/xliff/index.js';
import {
  XliffEntity,
  convertV1toV2,
  convertXliffToEntities,
} from '../../common/xliff/utils.js';
import { Xliff } from '../../common/xliff/xliff-spec.js';
import {
  DolphinJSON,
  DolphinJSONLocalizationState,
} from '../../storage/index.js';
import { ExportParser } from '../index.js';

/**
 * XliffParser is a parser for XLIFF files, which is commly used as a standard format for localization. So if any localization tool supports converting strings to XLIFF format, it can be consumed by Dolphin via this parser.
 *
 * The parser supports both Xliff v1 and v2.
 *
 * Each file represents one language, and have a structure like:
 *
 * [en].xliff:
 * <file>
 *   <body>
 *     <trans-unit id="1">
 *       <source>Home</source>
 *       <target>Home</target>
 *     </trans-unit>
 *   </body>
 * </file>
 */
export class XliffParser implements ExportParser {
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
        format: 'xliff',
      },
      strings: {},
    };

    const doc = parseXliffText(options.content);
    let xliff: Xliff;
    if (doc.version === XliffVersion.V2) {
      xliff = doc.doc.elements[0];
    } else {
      xliff = convertV1toV2(
        doc.doc.elements[0],
        options.language,
        options.language,
      );
    }

    const entities = convertXliffToEntities(xliff);
    // check if source language matches
    for (const entity of Object.values(entities)) {
      if (entity.sourceLanguage !== options.language) {
        throw new Error(
          `Source language mismatch: ${entity.sourceLanguage} vs ${options.language}`,
        );
      }
      json.strings[entity.key] = {
        comment: entity.notes?.join('\n'),
        localizations: {
          [options.language]: {
            state: 'new',
            metadata: {
              extractedFrom: 'source',
              state: entity.state,
              subState: entity.subState,
            },
            value: entity.sourceValue,
          },
        },
      };
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

    const doc = parseXliffText(options.content);
    let file: Xliff;
    if (doc.version === XliffVersion.V2) {
      file = doc.doc.elements[0];
    } else {
      file = convertV1toV2(
        doc.doc.elements[0],
        options.language,
        options.language,
      );
    }

    const entities = convertXliffToEntities(file);

    // Use map to improve performance
    const entitiesMap = new Map<string, XliffEntity>();
    for (const entity of entities) {
      entitiesMap.set(entity.key, entity);
    }

    for (const key in json.strings) {
      const entity = entitiesMap.get(key);
      if (entity) {
        const targetValue = entity.targetValue;
        const state = this.parseState({
          state: entity.state,
          defaultState: targetValue !== undefined ? 'translated' : 'new',
        });

        json.strings[key].localizations[options.language] = {
          state: state,
          metadata: {
            extractedFrom: targetValue !== undefined ? 'existing' : 'undefined',
            state: entity.state,
            subState: entity.subState,
          },
          value: targetValue,
        };
      } else {
        json.strings[key].localizations[options.language] = {
          state: 'new',
          metadata: {
            extractedFrom: 'undefined',
          },
        };
      }
    }
    return json;
  }

  private parseState(params: {
    state?: string;
    defaultState: DolphinJSONLocalizationState;
  }): DolphinJSONLocalizationState {
    const { state, defaultState } = params;
    if (state === undefined) {
      return defaultState;
    }
    switch (state) {
      case 'initial':
        return 'new';
      case 'translated':
        return 'translated';
      case 'reviewed':
        return 'reviewed';
      case 'final':
        return 'reviewed';
      default:
        logger.warn(`Unknown state: ${state}`);
        throw new Error(
          `Unknown state for xliff: ${state}. Please submit an issue or PR.`,
        );
    }
  }
}
