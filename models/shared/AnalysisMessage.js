import mongoose from 'mongoose';

// Separate Collection für bessere Performance bei vielen Messages
const analysisMessageSchema = new mongoose.Schema({
    chatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AnalysisChat',
        required: true,
        index: true 
    },
    role: {
        type: String,
        enum: ['user', 'assistant', 'system', 'tool'],
        required: true,
        index: true
    },
    content: {
        type: String, // fertige antwort oder tool befehl
        default: ''
    },
    files: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File'
    }],
    metadata: {
        type: Object,
        default: {}
    },
    agentPlan: {
        type: Object,
        default: null
    },
    toolCalls: [{
        tool: String,
        arguments: Object,
        timestamp: Date
    }],
    toolResults: [{
        tool: String,
        result: Object,
        success: Boolean,
        duration_ms: Number
    }],
    
    //LLM Usage Tracking (Provider-agnostic)
    usage: {
        provider: {
            type: String,
            enum: ['openai', 'anthropic', 'vllm', 'ollama'],
        },
        model: {
            type: String, // e.g., 'gpt-4-turbo', 'claude-3-5-sonnet-20241022'
        },
        tokens: {
            input: { type: Number, default: 0 },        // aka prompt_tokens (OpenAI)
            output: { type: Number, default: 0 },       // aka completion_tokens (OpenAI)
            total: { type: Number, default: 0 },
            cached: { type: Number, default: 0 }        // For Anthropic Prompt Caching
        },
        cost: {
            input: { type: Number, default: 0 },        // Cost in USD (input tokens)
            output: { type: Number, default: 0 },       // Cost in USD (output tokens)
            total: { type: Number, default: 0 }         // Total cost in USD
        },
        latency: {
            firstToken_ms: { type: Number },            // Time to first streaming chunk
            total_ms: { type: Number },                 // Total response time
            tokensPerSecond: { type: Number }           // Generation speed
        },
        estimated: { type: Boolean, default: false }    // ✨ True if tokens were estimated (not from provider)
    }
}, {
    timestamps: true // Automatisch createdAt und updatedAt
});

// Compound Index für optimales Query-Pattern (chatId + chronologische Sortierung)
analysisMessageSchema.index({ chatId: 1, createdAt: 1 });

export default mongoose.models.AnalysisMessage || mongoose.model('AnalysisMessage', analysisMessageSchema);