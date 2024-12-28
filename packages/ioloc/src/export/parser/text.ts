import { createHash } from 'node:crypto';
import path from 'node:path';

import { DolphinJSON } from '../../storage/index.js';
import { ExportParser } from '../index.js';

// export function keyOfUnit(fileId: string): string {
//   const hash = createHash('sha256').update(fileId).digest('hex');
//   return `${path.basename(fileId)}_${hash.substring(0, 5)}`;
// }

const MAX_CONTEXT_LENGTH = 5000;

/**
 * TextParser is a parser for plain text files. The parser will treat all the content as a single string unit, using the fileId to generate the key.
 *
 * Note: since it treats the whole file as a single string, file content length needs to be considered for traslation. If it's too long to exceed language model's context, translation may fail. This should be properly handled during translation.
 *
 * Each file represents one language, and have a structure like:
 *
 * [en].txt:
 * This update is to fix the issue that the user cannot see the updated content in the app.
 */
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
      metadata: {
        format: 'text',
      },
      strings: {},
    };

    // We simply use the content hash as the key
    const key = options.fileId;
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
    const expectedKey = options.fileId;
    for (const key in json.strings) {
      if (key !== expectedKey) {
        throw new Error(
          `Invalid json format for text file. Got key ${key}, expected ${expectedKey}.`,
        );
      }
      const state = options.content !== undefined ? 'undefined' : 'new';
      const extractedFrom =
        options.content !== undefined ? 'existing' : 'undefined';
      json.strings[key].localizations[options.language] = {
        state,
        metadata: {
          extractedFrom,
        },
        value: options.content,
      };
    }

    return json;
  }
}
