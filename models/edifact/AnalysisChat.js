import mongoose from 'mongoose';
import { analysisMessageSchema } from './AnalysisMessage.js';
import { edifactAnalysisSchema } from './EdifactAnalysis.js';

const analysisChatSchema = mongoose.Schema({
    name: {
        type: String,
        trim: true,
        required: true
    },

    creatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    messages: {
        type: [analysisMessageSchema],
        default: []
    },

    selectedModel: {
        type: String, // gpt-4.1, llama3, mistral, ...
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
        enum: ['default', 'manager', 'business', 'tech', 'analyst'],
        default: 'default'
    },

    domainContext: {
        edifact: {
            subset: String, // User input: Expected subset
            messageType: String, // User input: Expected message type
            releaseVersion: String, // User input: Expected version
            standardFamily: String, // User input: Expected standard/family 

            fileId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'File',
                required: true
            },

            options: {
                type: Object,
                default: {}
            },

            _analysis: edifactAnalysisSchema
        }
    },

}, {
    timestamps: true // Automatisch createdAt und updatedAt
});

analysisChatSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret._id = ret._id.toString();
        if (ret.creatorId) ret.creatorId = ret.creatorId.toString();
        if (ret.apiKeyRef) ret.apiKeyRef = ret.apiKeyRef.toString();
        if (ret.domainContext?.edifact?.fileId) {
            ret.domainContext.edifact.fileId = ret.domainContext.edifact.fileId.toString();
        }
        return ret;
    }
});
export default mongoose.models.AnalysisChat || mongoose.model('AnalysisChat', analysisChatSchema)