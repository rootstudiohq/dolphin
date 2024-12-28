import { Config } from '@repo/base/config';

import { LocalizationEntity } from '../entity.js';

export interface Translator {
  translate(
    entities: LocalizationEntity[],
    config: Config,
    onProgress?: (progress: number) => void,
  ): Promise<LocalizationEntity[]>;
  additionalInfo(): any;
}
