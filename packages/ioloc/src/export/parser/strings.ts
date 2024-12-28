import { DotStringsItem, DotStringsParser } from '../../common/dotstrings.js';
import { DolphinJSON } from '../../storage/index.js';
import { ExportParser } from '../index.js';

/**
 * AppleStringsParser is a parser for Apple Strings localization files (.strings).
 * Each file represents one language, and have a structure like:
 *
 * [en].strings:
 * "Home Title" = "Home";
 * "Welcome Description" = "Welcome to our home page";
 */
export class AppleStringsParser implements ExportParser {
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
        format: 'appleStrings',
      },
      strings: {},
    };

    const parser = new DotStringsParser(false);
    const items: DotStringsItem[] = [];
    parser.onItem((item) => items.push(item));
    parser.feed(options.content);

    for (const item of items) {
      if (item.key) {
        json.strings[item.key] = {
          comment: item.comment || undefined,
          localizations: {
            [options.language]: {
              state: 'new',
              metadata: {
                extractedFrom: 'source',
              },
              value: item.value ?? undefined,
            },
          },
        };
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
    const items: DotStringsItem[] = [];
    if (options.content && options.content.trim().length > 0) {
      const parser = new DotStringsParser(false);
      parser.onItem((item) => items.push(item));
      parser.feed(options.content);
    }

    for (const key in json.strings) {
      const item = items.find((i) => i.key === key);
      if (item) {
        json.strings[key].localizations[options.language] = {
          state: 'undefined',
          metadata: {
            extractedFrom: 'existing',
          },
          value: item.value ?? undefined,
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
}
