import { writeFile } from '@repo/base/utils';

import { DolphinJSON } from '../../storage/index.js';
import { ImportMerger } from '../basic.js';
import { getTargetValue } from './common.js';

/**
 * JSONMerger merges DolphinJSON into a target JSON file.
 */
export class JSONMerger implements ImportMerger {
  async merge(options: {
    json: DolphinJSON;
    sourceFilePath: string;
    targetLanguage: string;
    targetFilePath: string;
  }): Promise<void> {
    const { json, targetLanguage, targetFilePath } = options;

    // Build the target JSON structure
    const targetJson: any = {};

    for (const [key, value] of Object.entries(json.strings)) {
      const targetValue = getTargetValue({
        json,
        targetLanguage,
        key,
      });
      if (targetValue === undefined) {
        continue;
      }
      // Split the encoded key path and decode each segment
      const keyPath = key.split('/').map(decodeURIComponent);

      // Build nested structure
      let current = targetJson;
      for (let i = 0; i < keyPath.length - 1; i++) {
        const segment = keyPath[i];
        if (!current[segment]) {
          current[segment] = {};
        }
        current = current[segment];
      }

      // Set the value at the leaf node
      current[keyPath[keyPath.length - 1]] = targetValue;
    }

    // Write the result to file
    await writeFile(targetFilePath, `${JSON.stringify(targetJson, null, 2)}\n`);
  }
}
