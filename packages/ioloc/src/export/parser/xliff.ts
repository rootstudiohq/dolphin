import { XliffVersion, parseXliffPath } from '../../xliff/index.js';
import { convertV1toV2 } from '../../xliff/utils.js';
import { Xliff } from '../../xliff/xliff-spec.js';
import { XliffExportParser } from '../index.js';

export class XliffParser implements XliffExportParser {
  async parse(
    filePath: string,
    language: string,
    sourceFilePath: string,
    sourceLanguage: string,
  ): Promise<Xliff> {
    const doc = await parseXliffPath(filePath);
    let file: Xliff;
    if (doc.version === XliffVersion.V2) {
      file = doc.doc.elements[0];
    } else {
      file = convertV1toV2(doc.doc.elements[0], sourceFilePath, sourceLanguage);
    }
    if (file.attributes.trgLang === undefined) {
      file.attributes.trgLang = language;
    } else if (file.attributes.trgLang !== language) {
      throw new Error(
        `Target language mismatch: ${file.attributes.trgLang} vs ${language}`,
      );
    }
    return file;
  }
}
