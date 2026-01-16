import mongoose from 'mongoose';

export const analysisMessageSchema = new mongoose.Schema({
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
    }]
}, {
    timestamps: true // Automatisch createdAt und updatedAt
});

export default mongoose.models.AnalysisMessage || mongoose.model('AnalysisMessage', analysisMessageSchema);