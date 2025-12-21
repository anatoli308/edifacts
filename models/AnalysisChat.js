import mongoose from 'mongoose';
import analysisMessageSchema from '@/app/models/AnalysisMessage.js';

const analysisChatSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    messages: [analysisMessageSchema],

    provider: {
        type: String,
        enum: ['openai', 'anthropic', 'vllm'],
        required: true
    },

    model: {
        type: String, // gpt-4.1, llama3, mistral
        required: true
    },

    apiKeyRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ApiKey',
        required: true
    },

    personalizedPrompt: {
        type: String,
        default: ''
    },

    promptPreset: {
        type: String,
        enum: ['default', 'manager', 'business', 'tech', 'analyst', 'creative'],
        default: 'default'
    },

    domainContext: {
        edifact: {
            subset: {
                type: String, // z.B. ODETTE, INVOIC, ORDERS
                index: true
            },

            fileId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'File'
            },

            version: String, // D96A, D01B etc.

            options: {
                type: Object,
                default: {}
            }
        }
    },

    analysis: {
        edifact: {
            messageType: String, // INVOIC
            detectedSubset: String, // falls auto-detected
            segments: [String], // ['UNH','BGM','DTM']
            segmentCount: Number,

            validation: {
                errors: Number,
                warnings: Number,
                details: [{
                    segment: String,
                    error: String,
                    warning: String,
                    line: Number
                }],
            },

            parties: [String], // BY, SU, DP
            dates: [String],

            summary: String, // human readable
            llmContext: String, // token-optimierte Kurzfassung

        },

        status: {
            type: String,
            enum: ['pending', 'parsed', 'validated', 'error'],
            default: 'pending'
        }
    }
}, {
    timestamps: true // Automatisch createdAt und updatedAt
});

export default mongoose.models.AnalysisChat || mongoose.model('AnalysisChat', analysisChatSchema)