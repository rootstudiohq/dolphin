import { writeFile } from '@repo/base/utils';

import { DotStringsItem } from '../../common/dotstrings.js';
import { DolphinJSON } from '../../storage/index.js';
import { ImportMerger } from '../basic.js';
import { getTargetValue } from './common.js';

/**
 * AppleStringsMerger merges DolphinJSON into a .strings file format used by Apple platforms.
 */
export class AppleStringsMerger implements ImportMerger {
  async merge(options: {
    json: DolphinJSON;
    sourceFilePath: string;
    targetLanguage: string;
    targetFilePath: string;
  }): Promise<void> {
    const { json, targetLanguage, targetFilePath } = options;

    // Build the strings items
    const items: DotStringsItem[] = [];

    for (const [key, value] of Object.entries(json.strings)) {
      const targetValue = getTargetValue({
        json,
        targetLanguage,
        key,
      });
      if (targetValue === undefined) {
        continue;
      }

      // Create DotStringsItem with comment, key and value
      const item = new DotStringsItem(value.comment || null, key, targetValue);
      items.push(item);
    }

    // Convert items to string and join with double newlines
    const output = items.map((item) => item.toString()).join('\n\n');

    // Write the result to file
    await writeFile(targetFilePath, output + '\n');
  }
}
