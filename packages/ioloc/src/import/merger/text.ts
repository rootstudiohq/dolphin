import { logger } from '@repo/base/logger';
import { writeEmptyFile, writeFile } from '@repo/base/utils';

import { DolphinJSON } from '../../storage/index.js';
import { ImportMerger } from '../basic.js';
import { MergeBehavior } from './common.js';
import { getTargetValue } from './common.js';

/**
 * TextMerger is a merger for plain text files. It will simply replace the target file with the traslated string.
 */
export class TextMerger implements ImportMerger {
  async merge(options: {
    json: DolphinJSON;
    sourceFilePath: string;
    targetLanguage: string;
    targetFilePath: string;
  }): Promise<void> {
    // make sure the string unit has only one
    const json = options.json;
    if (Object.keys(json.strings).length !== 1) {
      throw new Error(
        `Invalid json format for text file. Got ${Object.keys(json.strings).length} keys, expected only 1 key.`,
      );
    }
    const key = Object.keys(json.strings)[0];
    const targetValue = getTargetValue({
      json,
      targetLanguage: options.targetLanguage,
      key,
    });
    if (targetValue === undefined) {
      return;
    }
    await writeFile(options.targetFilePath, targetValue);
  }
}

// export class XliffTextMerger implements ImportMerger {
//   async merge(xliff: Xliff, config: MergeConfig): Promise<void> {
//     const filePath = config.targetLanguage.to;
//     // make sure output parent folder exists if not create it
//     const fileFolder = path.dirname(filePath);
//     if (!fs.existsSync(fileFolder)) {
//       await fs.promises.mkdir(fileFolder, { recursive: true });
//     }

//     const file = xliff.elements[0];
//     if (!file) {
//       logger.warn(`No xliff file element in ${filePath}`);
//       await fs.promises.writeFile(filePath, '');
//       return;
//     }

//     const unit = file.elements.find((e) => e.name === 'unit') as
//       | Unit
//       | undefined;
//     if (!unit) {
//       logger.warn(`No unit element in ${filePath}`);
//       await fs.promises.writeFile(filePath, '');
//       return;
//     }
//     const segment = (unit.elements || []).find((e) => e.name === 'segment') as
//       | Segment
//       | undefined;
//     if (!segment) {
//       logger.warn(`No segment in ${filePath} for unit ${JSON.stringify(unit)}`);
//       await fs.promises.writeFile(filePath, '');
//       return;
//     }
//     if (segment.attributes?.state === 'initial') {
//       logger.warn(
//         `Segment <${JSON.stringify(segment)}> state is initial in ${filePath}, skip merging`,
//       );
//       await fs.promises.writeFile(filePath, '');
//       return;
//     }
//     const target = (segment.elements || []).find((e) => e.name === 'target') as
//       | Target
//       | undefined;
//     if (!target) {
//       logger.warn(`No target in ${filePath}`);
//       await fs.promises.writeFile(filePath, '');
//       return;
//     }
//     const targetText = elementAsText(target);
//     await fs.promises.writeFile(filePath, targetText);
//   }
// }
