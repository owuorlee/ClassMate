import { GoogleGenAI } from '@google/genai';

/** Minimal LLM abstraction so the extractor can cascade across models/providers. */
export interface LlmClient {
  readonly model: string;
  /** Returns the raw text of the model response (expected to be JSON). */
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}

export class GeminiClient implements LlmClient {
  private readonly ai: GoogleGenAI;

  constructor(
    readonly model: string,
    apiKey: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async complete(systemPrompt: string, userPrompt: string): Promise<string> {
    const res = await this.ai.models.generateContent({
      model: this.model,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        temperature: 0,
      },
    });
    const text = res.text;
    if (!text) throw new Error(`Empty response from ${this.model}`);
    return text;
  }
}
