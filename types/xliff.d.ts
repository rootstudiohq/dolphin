declare module 'xliff' {
  export type XliffTranslationString = string
  export interface XliffTranslationObject {
    Standalone: {
      id: string
      'equiv-text': string
    }
  }
  export type XliffTranslationArray = (
    | XliffTranslationString
    | XliffTranslationObject
  )[]
  export interface XliffFile {
    sourceLanguage: string
    targetLanguage: string
    resources: {
      [namespace: string]: {
        [translationId: string]: {
          source:
            | XliffTranslationString
            | XliffTranslationObject
            | XliffTranslationArray
          target:
            | XliffTranslationString
            | XliffTranslationObject
            | XliffTranslationArray
          note?: string
        }
      }
    }
  }
  function xliff2js(str: string, options?: any): Promise<XliffFile>
  function xliff12ToJs(str: string, options?: any): Promise<XliffFile>
  function js2xliff(obj: any, options?: any): Promise<string>
}
