import mongoose from 'mongoose';
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

// ✨ Virtual für bequemes Laden der Messages
analysisChatSchema.virtual('messages', {
    ref: 'AnalysisMessage',
    localField: '_id',
    foreignField: 'chatId',
    options: { sort: { createdAt: 1 } } // Chronologisch sortiert
});

// 🗑️ Automatisch Messages löschen wenn Chat gelöscht wird
analysisChatSchema.pre('deleteOne', { document: true, query: false }, async function() {
    const AnalysisMessage = mongoose.model('AnalysisMessage');
    await AnalysisMessage.deleteMany({ chatId: this._id });
    console.log(`[AnalysisChat] Deleted messages for chat ${this._id}`);
});

analysisChatSchema.pre('findOneAndDelete', async function() {
    const doc = await this.model.findOne(this.getQuery());
    if (doc) {
        const AnalysisMessage = mongoose.model('AnalysisMessage');
        await AnalysisMessage.deleteMany({ chatId: doc._id });
        console.log(`[AnalysisChat] Deleted messages for chat ${doc._id}`);
    }
});

// ✅ Virtuals in JSON/Object einschließen + Transform
analysisChatSchema.set('toJSON', {
    virtuals: true,
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

analysisChatSchema.set('toObject', { virtuals: true });

export default mongoose.models.AnalysisChat || mongoose.model('AnalysisChat', analysisChatSchema)