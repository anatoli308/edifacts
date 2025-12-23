import OpenAIProvider from '@app/lib/llmproviders/openai.js';

// Interface for all LLM providers

class ExplanationProvider {
    async explainMessage(message, context) {
        throw new Error('explainMessage() not implemented');
    }
}

// Factory to get the correct provider
function getProvider(type, options = {}) {
    switch (type) {
        case 'system':
            return new OpenAIProvider(options);
        // case 'openai':
        //   return new (require('./openai'))(options);
        // case 'anthropic':
        //   return new (require('./anthropic'))(options);
        default:
            throw new Error(`Unknown provider type: ${type}`);
    }
}

export { ExplanationProvider, getProvider };

