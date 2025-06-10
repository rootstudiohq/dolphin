import { OpenAIProvider, createOpenAI } from '@ai-sdk/openai';
import { LLMTranslatorConfig } from '@repo/base/config';
import { logger } from '@repo/base/logger';
import { LanguageModel, streamObject } from 'ai';
import { z } from 'zod';

import { TranslationPayload, TranslationProvider } from './provider.js';

export class OpenAITranslationProvider implements TranslationProvider {
  private openai: OpenAIProvider;
  private model: LanguageModel;

  constructor(options: { apiKey: string; model?: string }) {
    this.openai = createOpenAI({
      apiKey: options.apiKey,
      compatibility: 'strict', // https://sdk.vercel.ai/providers/ai-sdk-providers/openai#provider-instance
    });
    this.model = this.openai(options.model || 'gpt-4o');
  }

  async config() {
    const config: LLMTranslatorConfig = {
      maxOutputTokens: 16383,
      buffer: 0.3,
      maxRetry: 1,
      tokenizer: 'openai',
      tokenizerModel: 'gpt-4',
    };
    return config;
  }

  async translate(payload: TranslationPayload) {
    let instructions = `<instructions>As an app/website translator, your task is to translate texts to target languages, considering context and developer notes for accuracy and cultural appropriateness. It's essential to preserve original format, including line breaks, separators, escaping characters and localization symbols, otherwise, user interface may break.

The input is in JSON format, each key is a source text id, and the value is an object with source text and optional developer notes (for translation guidance). Translate only the 'value' with given context and developer notes, keeping the 'key' as is. 

Output should be in strict JSON format: each source key links to an object with target languages as keys and translated texts as values. \n

<example>
<input>
Context: Just for demo
Translate from en-US to zh-CN, ja:
{"key1": {"source": "Hello "%@\\nWelcome!", "notes": ["%@ is a placeholder for name"]}, "key2": {"source": "Goodbye", "notes": ["This is a farewell:\n\n* If the text is a greeting, use \\"Hello\\" in Chinese.\n\n* If the text is a farewell, use \\"Goodbye\\" in Chinese."]}}

<output>
{"key1": {"zh-CN": "你好 "%@\\n欢迎!", "ja": "こんにちは "%@\\nようこそ!"}, "key2": {"zh-CN": "遵守以下规则:\n\n* 如果文本是问候语，使用“你好”。\n\n* 如果文本是告别语，使用“再见”。", "ja": "以下のルールに従って翻訳してください:\n\n* テキストが挨拶の場合、「こんにちは」と翻訳してください。\n\n* テキストが告別の場合、「さようなら」と翻訳してください。"}}

</example>`;
    if (payload.context) {
      instructions += `\nContext: \n${payload.context}\n`;
    }
    let userContent = `Translate from ${
      payload.sourceLanguage
    } to target languages: [${payload.targetLanguages.join(', ')}].\n\n`;
    let contentJson: Record<string, any> = {};
    for (const content of payload.contents) {
      contentJson[content.key] = {
        source: content.source,
      };
      if (content.notes) {
        contentJson[content.key].notes = content.notes;
      }
    }
    userContent += JSON.stringify(contentJson);
    const TranslationReponseSchema = z.record(
      z.string(),
      z.record(
        z.enum(
          payload.targetLanguages.length > 0
            ? (payload.targetLanguages as [string, ...string[]])
            : ['en-US'],
        ),
        z.string(),
      ),
    );
    logger.info(`Translating with instructions: ${instructions}`);
    logger.info(`Translating with user content: ${userContent}`);
    const result = streamObject({
      model: this.model,
      mode: 'json',
      schema: TranslationReponseSchema,
      system: instructions,
      prompt: userContent,
      onFinish: (e) => {
        if (e.error) {
          logger.error(`Error translating streaming object error: ${e.error}`);
          return;
        }
        logger.info(
          `Finished translating, usage: ${e.usage}, object: ${JSON.stringify(e.object)}`,
        );
      },
    });
    return result;
  }
}
