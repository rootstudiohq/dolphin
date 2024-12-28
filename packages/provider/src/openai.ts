import { OpenAIProvider, createOpenAI } from '@ai-sdk/openai';
import { LLMTranslatorConfig } from '@repo/base/config';
import { logger } from '@repo/base/logger';
import { LanguageModel, streamObject } from 'ai';
import { z } from 'zod';

import { TranslationPayload, TranslationProvider } from './provider.js';

export class OpenAITranslationProvider implements TranslationProvider {
  private openai: OpenAIProvider;
  private model: LanguageModel;

  constructor(options: { apiKey: string }) {
    this.openai = createOpenAI({
      apiKey: options.apiKey,
      compatibility: 'strict', // https://sdk.vercel.ai/providers/ai-sdk-providers/openai#provider-instance
    });
    this.model = this.openai('gpt-4o-mini');
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
    let instructions = `As an app/website translator, your task is to translate texts to target languages, considering context and developer notes for accuracy and cultural appropriateness. It's essential to preserve original format, including line breaks, separators, escaping characters and localization symbols, otherwise, user interface may break.

Source texts are in key=value format, value may contain placeholders for dynamic content and can extend to multiple lines. Translate only the 'value', keeping the 'key' as is. Lines starting with "//" are developer notes for translation guidance.

Example1:

====
// %@ is a placeholder for name
key1=Hello "%@"\\nWelcome!

key2=Follow the rules:

* If the text is a greeting, use "Hello" in Chinese.

* If the text is a farewell, use "Goodbye" in Chinese.
====

can be translate to the following in Chinese:

====
key1=你好 "%@"\\n欢迎!

key2=遵守以下规则:

* 如果文本是问候语，使用“你好”。

* 如果文本是告别语，使用“再见”。
====

Output should be in JSON format: each source key links to an object with target languages as keys and translated texts as values. \n`;
    if (payload.context) {
      instructions += `\nTranslation context: \n${payload.context}\n`;
    }
    let userContent = `Translate from ${
      payload.sourceLanguage
    } to target languages: [${payload.targetLanguages.join(', ')}].\n\n`;
    userContent += '=====\n\n';
    for (const content of payload.contents) {
      if (content.notes) {
        for (const note of content.notes) {
          userContent += `// ${note}\n`;
        }
      }
      userContent += `${content.key}=${content.source}\n\n`;
    }
    const TranslationReponseSchema = z.record(
      z.string(),
      z.record(
        z.enum([
          payload.targetLanguages[0],
          ...payload.targetLanguages.slice(1),
        ]),
        z.string(),
      ),
    );
    logger.info(`Translating with instructions: ${instructions}`);
    logger.info(`Translating with user content: ${userContent}`);
    const result = await streamObject({
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
