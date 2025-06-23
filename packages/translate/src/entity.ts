import {
  DolphinJSONLocalizationState,
  DolphinJSONLocalizationUnit,
  DolphinJSONStringUnit,
} from '@repo/ioloc/storage';

export type LocalizationEntityDictionary = {
  [key: string]: LocalizationEntity;
};

export type LocalizationTarget = {
  value?: string;
  state?: 'initial' | 'translated' | 'reviewed' | 'final';
  subState?: string;
  notes: string[]; // Commnet/note for translators
};

export class LocalizationEntity {
  key: string;
  sourceLanguage: string;
  unit: DolphinJSONStringUnit;

  constructor({
    key,
    sourceLanguage,
    unit,
  }: {
    key: string;
    sourceLanguage: string;
    unit: DolphinJSONStringUnit;
  }) {
    this.key = key;
    this.sourceLanguage = sourceLanguage;
    this.unit = unit;
  }

  get sourceText(): string {
    const source = this.unit.localizations[this.sourceLanguage];
    if (!source) {
      throw new Error(`Source language ${this.sourceLanguage} not found.`);
    }
    if (source.value === undefined || source.value === null) {
      throw new Error(`Source value not found for ${this.key}`);
    }
    return source.value;
  }

  get targetLanguages(): string[] {
    const allLanguages = Object.keys(this.unit.localizations);
    // remove source language
    return allLanguages.filter((lang) => lang !== this.sourceLanguage);
  }

  get needsReview(): boolean {
    const skipReview = this.targetLanguages.every((lang) => {
      const target = this.unit.localizations[lang]!;
      return this.isTargetFinal(target);
    });
    return !skipReview;
  }

  get untranslatedLanguages(): string[] {
    const unstranslated = this.targetLanguages.filter((lang) => {
      const target = this.unit.localizations[lang]!;
      return !this.isTranslated(target);
    });
    return unstranslated.sort();
  }

  get allComments(): string[] {
    const comment = this.unit.comment;
    const additionalComments = this.unit.metadata?.additionalComments;
    const comments = [];
    if (comment) {
      comments.push(comment);
    }
    if (additionalComments) {
      comments.push(...additionalComments);
    }
    return comments;
  }

  get isFinal(): boolean {
    return this.targetLanguages.every((lang) => {
      const target = this.unit.localizations[lang]!;
      return this.isTargetFinal(target);
    });
  }

  get isAllTranslated(): boolean {
    return this.targetLanguages.every((lang) => {
      const target = this.unit.localizations[lang]!;
      return this.isTranslated(target);
    });
  }

  isTargetFinal(target: DolphinJSONLocalizationUnit): boolean {
    return target.state === 'reviewed';
  }

  isTranslated(target: DolphinJSONLocalizationUnit): boolean {
    if (this.isTargetFinal(target)) {
      return true;
    }
    if (target.state === 'translated' || target.state === 'review_skipped') {
      return true;
    }
    if (target.state === 'undefined') {
      // TODO: need a new config to allow user control whether to consider previous unmanaged strings as translated
      return true;
    }
    return false;
  }

  updateState(
    state: DolphinJSONLocalizationState,
    reviewResult?: 'approved' | 'declined' | 'refineNeeded',
  ) {
    for (const lang in this.unit.localizations) {
      this.unit.localizations[lang]!.state = state;
      if (reviewResult) {
        if (!this.unit.metadata) {
          this.unit.metadata = {};
        }
        this.unit.metadata.reviewResult = reviewResult;
      }
    }
  }

  addAdditionalComments(comments: string[]) {
    if (!this.unit.metadata) {
      this.unit.metadata = {};
    }
    if (!this.unit.metadata.additionalComments) {
      this.unit.metadata.additionalComments = [];
    }
    this.unit.metadata.additionalComments = [
      ...this.unit.metadata.additionalComments,
      ...comments,
    ];
  }
}
