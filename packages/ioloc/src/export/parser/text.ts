import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { DolphinJSON } from '../../storage/index.js';
import { textHash } from '../../utils.js';
import { Xliff } from '../../xliff/xliff-spec.js';
import { ExportParser, XliffExportParser } from '../index.js';

export class XliffTextParser implements XliffExportParser {
  async parse(
    filePath: string,
    language: string,
    sourceFilePath: string,
    sourceLanguage: string,
    basePath: string,
  ): Promise<Xliff> {
    const fileId = textHash(sourceFilePath);
    const xliffOriginalPath = path.relative(basePath, filePath);
    let targetText = '';
    if (fs.existsSync(filePath)) {
      targetText = await fs.promises.readFile(filePath, 'utf-8');
    }
    const sourceText = await fs.promises.readFile(sourceFilePath, 'utf-8');
    const state = targetText !== '' ? 'translated' : 'initial';
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
          elements: [
            {
              name: 'unit',
              type: 'element',
              attributes: {
                id: fileId,
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
                          text: sourceText,
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
            },
          ],
        },
      ],
    };
  }
}

export function keyOfText(filepath: string, text: string): string {
  const hash = createHash('sha256').update(text).digest('hex');
  return `${path.basename(filepath)}_${hash.substring(0, 8)}`;
}

export class TextParser implements ExportParser {
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

    // We simply use the content hash as the key
    const key = keyOfText(options.fileId, options.content);
    json.strings[key] = {
      comment: undefined,
      localizations: {
        [options.language]: {
          state: 'new',
          metadata: {
            extractedFrom: 'source',
          },
          value: options.content,
        },
      },
    };

    return json;
  }

  async exportTarget(options: {
    fileId: string;
    content?: string;
    language: string;
    json: DolphinJSON;
  }): Promise<DolphinJSON> {
    const json = options.json;
    // since this is a plain text file, there should be only one key
    if (Object.keys(json.strings).length !== 1) {
      throw new Error(
        `Invalid json format for text file. Got ${Object.keys(json.strings).length} keys, expected only 1 key.`,
      );
    }
    for (const key in json.strings) {
      const content =
        options.content ||
        json.strings[key].localizations[json.sourceLanguage].value;
      json.strings[key].localizations[options.language] = {
        state: 'translated',
        metadata: {
          extractedFrom: 'existing',
        },
        value: content,
      };
    }

    return json;
  }
}
