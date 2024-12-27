import { writeFile } from '@repo/base/utils';

import {
  Xliff,
  Xliff1,
  Xliff1File,
  XliffVersion,
  parseXliffPath,
  stringifyDoc,
  stringifyXliff1,
  stringifyXliff2,
} from '../../common/xliff/index.js';
import { convertV1toV2, convertV2toV1 } from '../../common/xliff/utils.js';
import { DolphinJSON } from '../../storage/index.js';
import { ImportMerger } from '../basic.js';
import { getTargetValue } from './common.js';

/**
 * XliffMerger merges DolphinJSON into XLIFF format by:
 * 1. Copying the source XLIFF file to target path
 * 2. Using DFS to update each trans-unit while preserving the exact structure
 */
export class XliffMerger implements ImportMerger {
  async merge(options: {
    json: DolphinJSON;
    sourceFilePath: string;
    targetLanguage: string;
    targetFilePath: string;
  }): Promise<void> {
    const { json, sourceFilePath, targetLanguage, targetFilePath } = options;

    // Parse source XLIFF file
    const doc = await parseXliffPath(sourceFilePath);
    if (doc.version === XliffVersion.V2) {
      const xliff = doc.doc.elements[0];
      xliff.attributes.trgLang = targetLanguage;
      // Deep clone and update the XLIFF structure
      const translatedXliff = this.updateXliff2Structure(
        xliff,
        json,
        targetLanguage,
      );
      doc.doc.elements[0] = translatedXliff;
    } else {
      const xliff = doc.doc.elements[0];
      // Update target language for XLIFF 1.0
      xliff.elements.forEach((file: Xliff1File) => {
        if (file.name === 'file') {
          file.attributes['target-language'] = targetLanguage;
        }
      });
      // Deep clone and update the XLIFF structure
      const translatedXliff = this.updateXliff1Structure(
        xliff,
        json,
        targetLanguage,
      );
      doc.doc.elements[0] = translatedXliff;
    }
    // Write back in the same format as source
    const xml = stringifyDoc(doc);
    await writeFile(targetFilePath, xml);
  }

  private updateXliff2Structure(
    xliff: Xliff,
    json: DolphinJSON,
    targetLanguage: string,
  ): Xliff {
    // Deep clone the XLIFF structure
    const newXliff = JSON.parse(JSON.stringify(xliff));
    const sourceLanguage = xliff.attributes.srcLang;

    // DFS through the structure
    const updateNode = (node: any, keyPath: string[] = []) => {
      if (Array.isArray(node)) {
        node.forEach((n) => updateNode(n, keyPath));
        return;
      }

      if (typeof node === 'object' && node !== null) {
        // Build key path starting with sourceLanguage for file elements
        let newKeyPath = [...keyPath];
        if (node.name === 'file') {
          // Start with [sourceLanguage, fileId] for files
          newKeyPath = [sourceLanguage, node.attributes.id];
        } else if (node.name === 'group' && node.attributes?.id) {
          // Add group IDs to the path
          newKeyPath.push(node.attributes.id);
        }

        // If this is a segment, update its target
        if (node.type === 'segment') {
          const segmentId = node.attributes?.id;
          if (segmentId) {
            // Construct the full key path and encode components
            const key = [...newKeyPath, segmentId]
              .map((x) => encodeURIComponent(x))
              .join('/');

            const targetValue = getTargetValue({
              json,
              targetLanguage,
              key,
            });

            if (targetValue !== undefined) {
              // Find or create target element
              let targetElement = node.elements.find(
                (el: any) => el.name === 'target',
              );
              if (!targetElement) {
                targetElement = {
                  name: 'target',
                  elements: [],
                };
                // Add target after source
                const sourceIndex = node.elements.findIndex(
                  (el: any) => el.name === 'source',
                );
                if (sourceIndex !== -1) {
                  node.elements.splice(sourceIndex + 1, 0, targetElement);
                } else {
                  node.elements.push(targetElement);
                }
              }
              // Update target content
              targetElement.elements = [{ type: 'text', text: targetValue }];
            }
          }
        }

        // Continue DFS
        if (node.elements) {
          updateNode(node.elements, newKeyPath);
        }
        Object.values(node).forEach((value) => {
          if (typeof value === 'object' && value !== null) {
            updateNode(value, newKeyPath);
          }
        });
      }
    };

    updateNode(newXliff);
    return newXliff;
  }

  private updateXliff1Structure(
    xliff: Xliff1,
    json: DolphinJSON,
    targetLanguage: string,
  ): Xliff1 {
    // Deep clone the XLIFF structure
    const newXliff = JSON.parse(JSON.stringify(xliff));

    // DFS through the structure
    const updateNode = (
      node: any,
      keyPath: string[] = [],
      sourceLanguage?: string,
    ) => {
      if (Array.isArray(node)) {
        node.forEach((n) => updateNode(n, keyPath, sourceLanguage));
        return;
      }

      if (typeof node === 'object' && node !== null) {
        // Build key path starting with sourceLanguage for file elements
        let newKeyPath = [...keyPath];
        let currentSourceLang = sourceLanguage;

        if (node.name === 'file') {
          // Get source language from file element
          currentSourceLang = node.attributes['source-language'];
          // Start with [sourceLanguage, fileId] for files
          newKeyPath = [currentSourceLang, node.attributes.original];
        } else if (node.name === 'group' && node.attributes?.id) {
          // Add group IDs to the path
          newKeyPath.push(node.attributes.id);
        }

        // If this is a trans-unit, update its target
        if (node.name === 'trans-unit') {
          const unitId = node.attributes?.id;
          if (unitId && currentSourceLang) {
            // Construct the full key path and encode components
            const key = [...newKeyPath, unitId]
              .map((x) => encodeURIComponent(x))
              .join('/');

            const targetValue = getTargetValue({
              json,
              targetLanguage,
              key,
            });

            if (targetValue !== undefined) {
              // Find or create target element
              let targetElement = node.elements.find(
                (el: any) => el.name === 'target',
              );
              if (!targetElement) {
                targetElement = {
                  name: 'target',
                  elements: [],
                };
                // Add target after source
                const sourceIndex = node.elements.findIndex(
                  (el: any) => el.name === 'source',
                );
                if (sourceIndex !== -1) {
                  node.elements.splice(sourceIndex + 1, 0, targetElement);
                } else {
                  node.elements.push(targetElement);
                }
              }
              // Update target content
              targetElement.elements = [{ type: 'text', text: targetValue }];

              // Update state attribute for XLIFF 1.0
              node.attributes.state = 'translated';
            }
          }
        }

        // Continue DFS
        if (node.elements) {
          updateNode(node.elements, newKeyPath, currentSourceLang);
        }
        Object.values(node).forEach((value) => {
          if (typeof value === 'object' && value !== null) {
            updateNode(value, newKeyPath, currentSourceLang);
          }
        });
      }
    };

    updateNode(newXliff);
    return newXliff;
  }
}
