import mongoose from 'mongoose';

const analysisMessageChunkSchema = new mongoose.Schema({
    messageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AnalysisMessage',
        required: true,
        index: true
    },
    index: { type: Number, required: true }, // Reihenfolge der Chunks
    content: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }, // z.B. tokenCount
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.AnalysisMessageChunk || mongoose.model('AnalysisMessageChunk', analysisMessageChunkSchema);
