import { logger } from '@repo/base/logger';
import fs from 'node:fs';
import { z } from 'zod';

export const DOLPHIN_JSON_FILE_NAME = 'dolphin.json';

export const DolphinJSONLocalizationStateSchema = z.enum([
  'undefined',
  'new',
  'translated',
  'reviewed',
  'rejected',
  'review_skipped',
]);

export const DolphinJSONLocalizationUnitSchema = z.object({
  state: DolphinJSONLocalizationStateSchema,
  skip: z.boolean().optional(),
  metadata: z
    .object({
      extractedFrom: z
        .enum(['source', 'existing', 'undefined', 'dolphin'])
        .optional(),
    })
    .catchall(z.any())
    .optional(),
  value: z.string().optional(),
});

export const DolphinJSONStringUnitTypeSchema = z.enum([
  'stringUnit',
  'stringSet',
  'variations',
]);

export const DolphinJSONStringUnitSchema = z.object({
  localizations: z.record(z.string(), DolphinJSONLocalizationUnitSchema), // key is the language
  comment: z.string().optional(),
  metadata: z
    .object({
      stringCatalogUnitType: DolphinJSONStringUnitTypeSchema.optional(),
      additionalComments: z.array(z.string()).optional(), // Review comments
      reviewResult: z.enum(['approved', 'declined', 'refineNeeded']).optional(),
    })
    .catchall(z.any())
    .optional(),
});

export const DolphinJSONSchema = z.object({
  version: z.literal('1.0'),
  fileId: z.string(),
  sourceLanguage: z.string(),
  metadata: z
    .object({
      format: z.string().optional(),
      createdAt: z.string().datetime().optional(), // The time when the file was created, in ISO 8601 format
      lastExportedAt: z.string().datetime().optional(), // The time when project strings were last exported, in ISO 8601 format
      lastTranslatedAt: z.string().datetime().optional(), // The time when the file was last translated, in ISO 8601 format
      lastImportedAt: z.string().datetime().optional(), // The time when translations were last imported to the project, in ISO 8601 format
    })
    .catchall(z.any())
    .optional(),
  strings: z.record(z.string(), DolphinJSONStringUnitSchema),
});

// Type exports for TypeScript
export type DolphinJSONLocalizationState = z.infer<
  typeof DolphinJSONLocalizationStateSchema
>;
export type DolphinJSONLocalizationUnit = z.infer<
  typeof DolphinJSONLocalizationUnitSchema
>;
export type DolphinJSONStringUnitType = z.infer<
  typeof DolphinJSONStringUnitTypeSchema
>;
export type DolphinJSONStringUnit = z.infer<typeof DolphinJSONStringUnitSchema>;
export type DolphinJSON = z.infer<typeof DolphinJSONSchema>;

export async function readDolphinJSON(filePath: string): Promise<DolphinJSON> {
  let dolphinJsonContent: string;
  try {
    dolphinJsonContent = await fs.promises.readFile(filePath, 'utf-8');
  } catch (e) {
    const errorMessage = `Failed to read dolphin.json file at path: ${filePath}, error: ${e}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
  const dolphinJsonParsed = JSON.parse(dolphinJsonContent);
  const dolphinJsonResult =
    await DolphinJSONSchema.safeParseAsync(dolphinJsonParsed);
  if (!dolphinJsonResult.success) {
    throw new Error(
      `Invalid dolphin.json schema: ${dolphinJsonResult.error.message}`,
    );
  }
  return dolphinJsonResult.data;
}

export function untranslatedLanguages(unit: DolphinJSONStringUnit): string[] {
  return Object.keys(unit.localizations).filter(
    (language) =>
      unit.localizations[language].state === 'new' ||
      unit.localizations[language].state === 'rejected',
  );
}
