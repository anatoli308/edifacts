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
    }
}, {
    timestamps: true // Automatisch createdAt und updatedAt
});

export default mongoose.models.AnalysisMessage || mongoose.model('AnalysisMessage', analysisMessageSchema);