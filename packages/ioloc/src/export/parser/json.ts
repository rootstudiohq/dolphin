import fs from 'node:fs';
import path from 'node:path';

import { DolphinJSON } from '../../storage/index.js';
import { textHash } from '../../utils.js';
import { Unit, Xliff } from '../../xliff/xliff-spec.js';
import { ExportParser, XliffExportParser } from '../index.js';

export class XliffJsonParser implements XliffExportParser {
  async parse(
    filePath: string,
    language: string,
    sourceFilePath: string,
    sourceLanguage: string,
    basePath: string,
  ): Promise<Xliff> {
    const fileId = textHash(sourceFilePath);
    const xliffOriginalPath = path.relative(basePath, filePath);
    let targets: any;
    if (!fs.existsSync(filePath)) {
      targets = {};
    } else {
      const targetText = await fs.promises.readFile(filePath, 'utf-8');
      targets = JSON.parse(targetText);
    }
    const sourceText = await fs.promises.readFile(sourceFilePath, 'utf-8');
    let sources = JSON.parse(sourceText);
    let targetElements: Unit[] = [];
    // dfs sources till leaf nodes (not a object) and update if same key found in targets
    const dfs = (source: any, target: any, keys: string[]) => {
      for (let key in source) {
        const currentKeys = [...keys, key];
        if (typeof source[key] === 'object') {
          dfs(source[key], target[key], currentKeys);
        } else {
          const state = target && target[key] ? 'translated' : 'initial';
          const targetText =
            target && target[key] ? target[key] : source[key] || '';
          targetElements.push({
            name: 'unit',
            type: 'element',
            attributes: {
              id: currentKeys.map((x) => encodeURIComponent(x)).join('/'),
            },
            elements: [
              {
                name: 'segment',
                type: 'element',
                attributes: {
                  state,
                },
                elements: [
                  {
                    name: 'source',
                    type: 'element',
                    elements: [
                      {
                        type: 'text',
                        text: source[key],
                      },
                    ],
                  },
                  {
                    name: 'target',
                    type: 'element',
                    elements: [
                      {
                        type: 'text',
                        text: targetText,
                      },
                    ],
                  },
                ],
              },
            ],
          });
        }
      }
    };
    dfs(sources, targets, []);
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

/**
 * JsonParser is a parser for JSON localization files, which are widely used in frontend development, such as react, vue, etc.
 * Each json file usually represent one language, and have a structure like:
 *
 * en.json:
 * {
 *   "Home": {
 *     "title": "Home",
 *     "description": "Welcome to our home page"
 *   },
 *   "Welcome to our home page": "Welcome to our home page",
 * }
 *
 * Each leaf node can be treated as a localization unit, and the key is the traversal path of the leaf node.
 */
export class JsonParser implements ExportParser {
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
    // use a dfs to traverse the json file, and collect all the keys and values
    const source = JSON.parse(options.content);
    const dfs = (source: any, keys: string[]) => {
      for (let key in source) {
        const currentKeys = [...keys, key];
        if (typeof source[key] === 'object') {
          dfs(source[key], currentKeys);
        } else if (typeof source[key] === 'string') {
          const state = 'new';
          // urlencode each key and join with '/'
          const encodedKey = currentKeys
            .map((x) => encodeURIComponent(x))
            .join('/');
          // make sure the key is unique
          if (json.strings[encodedKey]) {
            throw new Error(
              `Duplicate key found in the json file. Key: ${encodedKey}, node path: ${currentKeys.join('.')}`,
            );
          }
          json.strings[encodedKey] = {
            comment: undefined, // Unfortunately, these kind of format doesn't support comment, submit an issue or PR if you need support for some frameworks
            localizations: {
              [options.language]: {
                state,
                metadata: {
                  extractedFrom: 'source',
                },
                value: source[key],
              },
            },
          };
        } else {
          throw new Error(
            `Unsupported type of the leaf node of the json file. Node path: ${currentKeys.join('.')}, type: ${typeof source[key]}`,
          );
        }
      }
    };
    dfs(source, []);
    return json;
  }

  async exportTarget(options: {
    fileId: string;
    content?: string;
    language: string;
    json: DolphinJSON;
  }): Promise<DolphinJSON> {
    const target =
      options.content && options.content.trim().length > 0
        ? JSON.parse(options.content)
        : {};
    const json = options.json;
    // for each key in source json, if the key exists in target json, update the target json
    for (let key in json.strings) {
      // extract key path
      const keyPath = key.split('/').map(decodeURIComponent);
      let current = target;
      for (let i = 0; i < keyPath.length; i++) {
        const key = keyPath[i];
        if (current[key] === undefined || current[key] === null) {
          current = null;
          break;
        }
        current = current[key];
      }
      if (current !== null && current !== undefined) {
        if (typeof current === 'string') {
          // An existing key in source json is found in target json, we will treat it as translated
          json.strings[key].localizations[options.language] = {
            state: 'translated',
            metadata: {
              extractedFrom: 'existing',
            },
            value: current,
          };
        } else {
          throw new Error(
            `Unsupported type of the leaf node of the json file. Node path: ${keyPath.join(
              '.',
            )}, type: ${typeof current}, value: ${JSON.stringify(current)}`,
          );
        }
      } else {
        // no existing key in source json is found in target json, we will treat it as new, and use source value as the target value for now
        // why? so all target languages to be translated are always in sync
        const sourceLanguage = json.sourceLanguage;
        const sourceValue =
          json.strings[key].localizations[sourceLanguage].value;
        json.strings[key].localizations[options.language] = {
          state: 'new',
          metadata: {
            extractedFrom: 'source',
          },
          value: sourceValue,
        };
      }
    }
    return json;
  }
}
