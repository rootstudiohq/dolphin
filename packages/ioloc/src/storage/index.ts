export type DolphinJSONLocalizationState =
  | 'new'
  | 'translated'
  | 'reviewed'
  | 'rejected'
  | 'review_skipped';

export interface DolphinJSONLocalizationUnit {
  state: DolphinJSONLocalizationState;
  skip?: boolean;
  metadata: {
    extractedFrom: 'source' | 'existing' | 'dolphin'; // Indicate if the localization string is extracted from copying source value, an existing translation, translated by a dolphin agent
    [key: string]: any; // Metadata for the localization string
  };
  value?: string;
}

export type DolphinJSONStringUnitType =
  | 'stringUnit'
  | 'stringSet'
  | 'variations';

export interface DolphinJSONStringUnit {
  comment?: string;
  metadata?: {
    stringCatalogUnitType?: DolphinJSONStringUnitType; // for string catalog metadata
    [key: string]: any; // Metadata for the original file
  };
  localizations: {
    [language: string]: DolphinJSONLocalizationUnit;
  };
}

export interface DolphinJSON {
  version: '1.0'; // The version of the Dolphin JSON format
  fileId: string; // The file ID
  sourceLanguage: string; // The source language of the file
  metadata: {
    [key: string]: any; // Metadata for the original file, depending on file format
  };
  strings: {
    [key: string]: DolphinJSONStringUnit;
  };
}
