import { logger } from '@repo/base/logger';
import fs from 'node:fs';
import { Options, js2xml, xml2js } from 'xml-js';

import { convertV1toV2, elementAsText } from './utils.js';
import { Xliff1, Xliff1Doc } from './xliff1-spec.js';
import type {
  File,
  Group,
  Segment,
  Unit,
  Xliff,
  XliffDoc,
} from './xliff-spec.js';

export * from './xliff-spec.js';
export * from './xliff1-spec.js';
export * from './utils.js';

export enum XliffVersion {
  V1 = '1',
  V2 = '2',
}

export type ParseOptions = Options.XML2JS;
export type StringifyOptions = Options.JS2XML;

export type XliffDocType =
  | {
      version: XliffVersion.V1;
      doc: Xliff1Doc;
    }
  | {
      version: XliffVersion.V2;
      doc: XliffDoc;
    };

export async function parseXliffPath(filePath: string): Promise<XliffDocType> {
  const content = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
  return parseXliffText(content);
}

export async function parseXliff2Path(filePath: string): Promise<XliffDoc> {
  const res = await parseXliffPath(filePath);
  if (res.version === XliffVersion.V2) {
    return res.doc;
  } else {
    const el = res.doc.elements[0].elements[0];
    const source = el.attributes['source-language'];
    const target = el.attributes['target-language'];
    if (!target) {
      throw new Error('Cannot find target language in XLIFF file');
    }
    const f = convertV1toV2(res.doc.elements[0], source, target);
    return {
      elements: [f],
    };
  }
}

export function parseXliffText(content: string): XliffDocType {
  // get xliff version string first
  const versionMatch = content.match(/version=\"([^"]*)\"/);
  if (!versionMatch || !versionMatch[1]) {
    throw new Error(`Cannot find xliff version in the content.`);
  }
  const version = versionMatch[1];
  logger.info(`Found xliff version: ${version}`);
  if (version.startsWith('1')) {
    return {
      version: XliffVersion.V1,
      doc: parseXliff1Text(content),
    };
  } else if (version.startsWith('2')) {
    return {
      version: XliffVersion.V2,
      doc: parseXliff2Text(content),
    };
  } else {
    throw new Error(`Unsupported xliff version: ${version}`);
  }
}

export function parseXliff2Text(src: string, options?: ParseOptions) {
  const opt: Options.XML2JS = Object.assign({ ignoreComment: true }, options, {
    cdataKey: 'text',
    compact: false,
  });
  const doc = xml2js(src, opt);
  if (
    !doc.elements ||
    doc.elements.length !== 1 ||
    doc.elements[0].name !== 'xliff'
  )
    throw new Error('Could not find <xliff> element in XML');
  return doc as XliffDoc;
}

export function parseXliff1Text(src: string, options?: ParseOptions) {
  const opt: Options.XML2JS = Object.assign({ ignoreComment: true }, options, {
    cdataKey: 'text',
    compact: false,
  });
  const doc = xml2js(src, opt);
  if (
    !doc.elements ||
    doc.elements.length !== 1 ||
    doc.elements[0].name !== 'xliff'
  )
    throw new Error('Could not find <xliff> element in XML');
  return doc as Xliff1Doc;
}

export function stringifyDoc(doc: XliffDocType, options?: StringifyOptions) {
  const opt = Object.assign({ spaces: 2 }, options, {
    compact: false,
    attributeValueFn: function (value: string) {
      return encodeXliffAttributeValue(value);
    },
  });
  return js2xml(doc.doc, opt);
}

export function stringifyXliff2(
  xliff: Xliff | XliffDoc,
  options?: StringifyOptions,
) {
  const doc = xliff.name === 'xliff' ? { elements: [xliff] } : xliff;
  const opt = Object.assign({ spaces: 2 }, options, {
    compact: false,
    attributeValueFn: function (value: string) {
      return encodeXliffAttributeValue(value);
    },
  });
  return js2xml(doc, opt);
}

export function stringifyXliff1(
  xliff: Xliff1 | Xliff1Doc,
  options?: StringifyOptions,
) {
  const doc = xliff.name === 'xliff' ? { elements: [xliff] } : xliff;
  const opt = Object.assign({ spaces: 2 }, options, {
    compact: false,
    attributeValueFn: function (value: string) {
      return encodeXliffAttributeValue(value);
    },
  });
  return js2xml(doc, opt);
}

export function mergeXliffs(source: Xliff, target: Xliff) {
  let merged = structuredClone(source);
  if (source.attributes.version !== target.attributes.version) {
    throw new Error(
      `Cannot merge XLIFF files with different versions: ${source.attributes.version} and ${target.attributes.version}`,
    );
  }
  if (target.attributes.trgLang) {
    merged.attributes.trgLang = target.attributes.trgLang;
  }
  let files = [];
  for (const sourceFile of merged.elements) {
    const targetFile = target.elements.find(
      (file) => file.attributes.id === sourceFile.attributes.id,
    );
    if (!targetFile) {
      logger.warn(
        `Cannot find target file for ${sourceFile.attributes.id}. Skip.`,
      );
      continue;
    }
    files.push(mergeFiles(sourceFile, targetFile));
  }
  merged.elements = files;
  return merged;
}

function mergeFiles(source: File, target: File) {
  if (target.attributes.original) {
    source.attributes.original = target.attributes.original;
  }
  if (target.attributes.trgDir) {
    source.attributes.trgDir = target.attributes.trgDir;
  }
  if (target.attributes.translate) {
    source.attributes.translate = target.attributes.translate;
  }
  for (const index in source.elements) {
    const element = source.elements[index]!;
    if (element.name === 'group') {
      const id = element.attributes.id;
      const targetGroup = target.elements.find(
        (group) => group.name === 'group' && group.attributes.id === id,
      ) as Group | undefined;
      if (targetGroup) {
        source.elements[index] = mergeGroups(element, targetGroup);
      }
    } else if (element.name === 'unit') {
      const id = element.attributes.id;
      const targetUnit = target.elements.find(
        (unit) => unit.name === 'unit' && unit.attributes.id === id,
      ) as Unit | undefined;
      if (targetUnit) {
        source.elements[index] = mergeUnits(element, targetUnit);
      }
    } else {
      continue;
    }
  }
  return source;
}

function mergeGroups(source: Group, target: Group) {
  if (target.attributes.translate) {
    source.attributes.translate = target.attributes.translate;
  }
  if (target.attributes.trgDir) {
    source.attributes.trgDir = target.attributes.trgDir;
  }
  const elements = source.elements || [];
  for (const index in elements) {
    const element = elements[index]!;
    if (element.name === 'group') {
      const id = element.attributes.id;
      const targetElements = target.elements || [];
      const targetGroup = targetElements.find(
        (group) => group.name === 'group' && group.attributes.id === id,
      ) as Group | undefined;
      if (targetGroup) {
        source.elements![index] = mergeGroups(element, targetGroup);
      }
    } else if (element.name === 'unit') {
      const id = element.attributes.id;
      const targetElements = target.elements || [];
      const targetUnit = targetElements.find(
        (unit) => unit.name === 'unit' && unit.attributes.id === id,
      ) as Unit | undefined;
      if (targetUnit) {
        source.elements![index] = mergeUnits(element, targetUnit);
      }
    } else {
      continue;
    }
  }
  return source;
}

function mergeUnits(source: Unit, target: Unit) {
  if (target.attributes.translate) {
    source.attributes.translate = target.attributes.translate;
  }
  if (target.attributes.trgDir) {
    source.attributes.trgDir = target.attributes.trgDir;
  }
  const elements = source.elements || [];
  if (elements.length === 1 && target.elements?.length === 1) {
    const sourceElement = elements[0]!;
    const targetElement = target.elements[0]!;
    if (sourceElement.name === 'segment' && targetElement.name === 'segment') {
      source.elements![0] = mergeSegments(sourceElement, targetElement);
    }
  } else {
    for (const index in elements) {
      const element = elements[index]!;
      const targetElements = target.elements || [];
      if (element.name === 'segment') {
        if (element.elements.length < 1) {
          throw new Error(
            `Invalid segment in ${source.attributes.id}. Missing source element.`,
          );
        }
        if (targetElements.length < 1) {
          continue;
        }
        const elementId = element.attributes?.id;
        const targetSegments = targetElements.filter(
          (segment) => segment.name === 'segment',
        ) as Segment[];
        if (elementId) {
          const targetSegment = targetSegments.find(
            (segment) => segment.attributes?.id === elementId,
          ) as Segment | undefined;
          if (targetSegment) {
            source.elements![index] = mergeSegments(element, targetSegment);
          }
        } else {
          const sourceElement = element.elements[0];
          const sourceContent = elementAsText(sourceElement);
          const targetSegment = targetSegments.find((segment) => {
            const targetSourceContent = elementAsText(segment.elements[0]);
            return sourceContent === targetSourceContent;
          }) as Segment | undefined;
          if (targetSegment) {
            source.elements![index] = mergeSegments(element, targetSegment);
          }
        }
      } else if (element.name === 'notes') {
        // const targetNotes = targetElements.find(
        //   (element) => element.name === 'notes',
        // ) as Notes | undefined
        // if (targetNotes) {
        //   let sourceNotes = element.elements || []
        //   for (const note of targetNotes.elements) {
        //     if (
        //       sourceNotes.find(
        //         (n) => n.elements[0].text === note.elements[0].text,
        //       ) === undefined
        //     ) {
        //       sourceNotes.push(note)
        //     }
        //   }
        //   source.elements![index].elements = sourceNotes
        // }
      } else {
        continue;
      }
    }
  }
  return source;
}

function mergeSegments(source: Segment, target: Segment) {
  if (source.attributes) {
    if (target.attributes?.state) {
      source.attributes.state = target.attributes?.state;
    }
    if (target.attributes?.subState) {
      source.attributes.subState = target.attributes?.subState;
    }
  }
  if (target.elements[1]) {
    source.elements = [source.elements[0], target.elements[1]];
  } else {
    source.elements = [source.elements[0]];
  }
  return source;
}

export const encodeXliffAttributeValue = function (attributeValue: string) {
  return attributeValue
    .replace(/&quot;/g, '"') // convert quote back before converting amp
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

export const decodeXliffAttributeValue = function (attributeValue: string) {
  return attributeValue
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
};
