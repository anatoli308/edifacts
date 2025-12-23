import { ExplanationProvider } from '@/app/lib/llmproviders/openai.js';

import fetch from 'node-fetch';

class OpenAIProvider extends ExplanationProvider {
    constructor(options = {}) {
        super();
        this.options = options;
        // z.B. API-Key, Model, Limits, etc.
    }

    async explainMessage(message, context) {
        const apiKey = this.options.apiKey;
        const model = this.options.model;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model,
                    messages: [
                        { role: 'system', content: 'Du bist ein EDIFACT-Experte.' },
                        { role: 'user', content: message }
                    ]
                })
            });

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || '';

            return {
                text,
                reasoning: 'Antwort von OpenAI.',
                provider: 'openai',
                metadata: { model, usage: data.usage }
            };
        } catch (error) {
            return {
                text: '',
                reasoning: 'Fehler beim OpenAI-API-Call.',
                provider: 'openai',
                metadata: { error: error.message }
            };
        }
    }
}

export default OpenAIProvider;
