import mongoose from 'mongoose';

const promptPresetSchema = new mongoose.Schema({
    promptPreset: {
        type: String,
        enum: ['default', 'manager', 'business', 'tech', 'analyst'],
        default: 'default'
    },

    content: {
        type: String,
        required: true,
    },

}, { timestamps: true });

export default mongoose.models.PromptPreset || mongoose.model('PromptPreset', promptPresetSchema);