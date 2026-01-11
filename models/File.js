import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    chatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AnalysisChat',
        index: true,
        required: true
    },

    originalName: {
        type: String,
        required: true
    },

    mimeType: {
        type: String,
        required: true
    },

    size: {
        type: Number, // bytes
        required: true,
        default: 0
    },

    storage: {
        type: String,
        enum: ['local', 's3', 'gcs', 'azure'],
        default: 'local',
        index: true
    },

    path: {
        type: String,
        // local: /uploads/2025/01/uuid.pdf
        // cloud: bucket/key
        required: true
    },

    status: {
        type: String,
        enum: ['uploaded', 'processing', 'complete', 'error'],
        default: 'uploaded'
    },

    metadata: {
        error: String,
        // weitere Felder je nach Bedarf
    }
}, {
    timestamps: true // Automatisch createdAt und updatedAt
});

export default mongoose.models.File || mongoose.model('File', fileSchema);