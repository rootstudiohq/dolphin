import { logger } from '@repo/base/logger';
import fs from 'node:fs';
import path from 'node:path';

import {
  XCStringsFile,
  parseXCStrings,
} from '../../export/parser/xcstrings.js';
import { decodeXliffAttributeValue } from '../../xliff/index.js';
import { elementAsText } from '../../xliff/utils.js';
import { Notes, Segment, Target, Unit, Xliff } from '../../xliff/xliff-spec.js';
import { ImportMerger, MergeConfig } from '../index.js';

export class XCStringsMerger implements ImportMerger {
  async merge(xliff: Xliff, config: MergeConfig): Promise<void> {
    let isUsingStringSet = false;
    // load source file
    const sourceFilePath = config.sourceLanguage.path;
    const sourceFileContent = await fs.promises.readFile(
      sourceFilePath,
      'utf-8',
    );
    const sourceXCStrings = parseXCStrings(sourceFileContent);

    // load target file
    const filePath = config.targetLanguage.to;
    const fileFolder = path.dirname(filePath);
    if (!fs.existsSync(fileFolder)) {
      await fs.promises.mkdir(fileFolder, { recursive: true });
    }

    if (!sourceXCStrings.strings) {
      logger.warn(`No strings in source XCStrings file: ${sourceFilePath}`);
      await fs.promises.writeFile(filePath, '{}');
      return;
    }
    // check if source file is using string set
    // isUsingStringSet = Object.values(sourceXCStrings.strings).some(
    //   (s) =>
    //     s.localizations &&
    //     s.localizations[sourceXCStrings.sourceLanguage]?.stringSet,
    // );

    // const file = xliff.elements[0];
    // if (!file) {
    //   logger.warn(`No xliff file element in ${filePath}`);
    //   await fs.promises.writeFile(filePath, '{}');
    //   return;
    // }

    // const units = (file.elements ?? []).filter(
    //   (e) => e.name === 'unit',
    // ) as Unit[];
    // if (units.length === 0) {
    //   logger.warn(`No unit element in ${filePath}`);
    //   await fs.promises.writeFile(filePath, '{}');
    //   return;
    // }

    // let xcstrings: XCStringsFile;
    // try {
    //   const existingContent = await fs.promises.readFile(filePath, 'utf-8');
    //   xcstrings = parseXCStrings(existingContent);
    // } catch (error) {
    //   logger.warn(`Failed to read existing XCStrings file: ${error}`);
    //   xcstrings = {
    //     sourceLanguage: xliff.attributes.srcLang,
    //     strings: {},
    //     version: '1.0',
    //   };
    // }

    // const targetLanguage = xliff.attributes.trgLang;
    // if (!targetLanguage) {
    //   throw new Error(`Missing target language in xliff file`);
    // }

    // for (const unit of units) {
    //   const segment = (unit.elements || []).find(
    //     (e) => e.name === 'segment',
    //   ) as Segment | undefined;
    //   if (!segment) {
    //     logger.warn(
    //       `No segment element in ${filePath} for unit: ${JSON.stringify(unit)}`,
    //     );
    //     continue;
    //   }
    //   if (segment.attributes?.state === 'initial') {
    //     logger.warn(
    //       `Segment <${JSON.stringify(segment)}> state is initial in ${filePath}, skip merging`,
    //     );
    //     continue;
    //   }
    //   const target = (segment.elements || []).find(
    //     (e) => e.name === 'target',
    //   ) as Target | undefined;
    //   let targetText = '';
    //   if (target) {
    //     targetText = elementAsText(target);
    //   }

    //   const commentElement = (unit.elements || []).find(
    //     (e) => e.name === 'notes',
    //   ) as Notes | undefined;
    //   const comment = commentElement
    //     ? elementAsText(commentElement)
    //     : undefined;

    //   const splitIds = unit.attributes.id.split('-');
    //   const index = parseInt(splitIds[splitIds.length - 1], 10);
    //   const key = decodeXliffAttributeValue(splitIds.slice(0, -1).join('-'));
    //   if (!xcstrings.strings[key]) {
    //     xcstrings.strings[key] = {
    //       extractionState:
    //         unit.attributes.extractionState !== undefined
    //           ? `${unit.attributes.extractionState}`
    //           : undefined,
    //       comment,
    //       localizations: {},
    //     };
    //   }

    //   if (!xcstrings.strings[key].localizations) {
    //     xcstrings.strings[key].localizations = {};
    //   }
    //   if (isUsingStringSet) {
    //     if (
    //       !xcstrings.strings[key].localizations[targetLanguage] ||
    //       !xcstrings.strings[key].localizations[targetLanguage].stringSet ||
    //       xcstrings.strings[key].localizations[targetLanguage].stringSet
    //         .values === undefined
    //     ) {
    //       xcstrings.strings[key].localizations[targetLanguage] = {
    //         stringSet: {
    //           state: 'translated',
    //           values: [],
    //         },
    //       };
    //     }
    //     const values =
    //       xcstrings.strings[key].localizations[targetLanguage].stringSet
    //         ?.values || [];
    //     if (values.length > index) {
    //       values[index] = targetText;
    //     } else {
    //       for (let i = values.length; i <= index; i++) {
    //         values.push('');
    //       }
    //       values[index] = targetText;
    //     }
    //     xcstrings.strings[key].localizations[targetLanguage].stringSet!.values =
    //       values;
    //   } else {
    //     xcstrings.strings[key].localizations[targetLanguage] = {
    //       stringUnit: {
    //         state: 'translated',
    //         value: targetText,
    //       },
    //     };
    //   }
    // }

    // await fs.promises.writeFile(filePath, JSON.stringify(xcstrings, null, 2));
  }
}
