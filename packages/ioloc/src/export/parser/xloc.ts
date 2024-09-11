import fs from 'node:fs';
import path from 'node:path';

import { Xliff } from '../../xliff/xliff-spec.js';
import { XliffExportParser } from '../index.js';
import { XliffParser } from './xliff.js';

export class XlocParser implements XliffExportParser {
  async parse(
    filePath: string,
    language: string,
    sourceFilePath: string,
    sourceLanguage: string,
  ): Promise<Xliff> {
    // For xcloc files, we need to parse the [lang].xliff file inside the "Localized Contents" folder.
    // For example, if the xcloc file is at "en.xcloc", then we need to parse "en.xcloc/Localized Contents/en.xliff".
    const xliffFilePath = path.join(
      filePath,
      `Localized Contents/${language}.xliff`,
    );
    const parser = new XliffParser();
    return await parser.parse(
      xliffFilePath,
      language,
      sourceFilePath,
      sourceLanguage,
    );
  }
}
