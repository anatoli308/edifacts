import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  provider: {
    type: String,
    enum: ['ollama', 'openai', 'anthropic', 'custom'],
    required: true
  },

  name: {
    type: String, // z.B. "Work OpenAI", "Personal Anthropic"
    required: true
  },

  encryptedKey: {
    type: String,
    required: true
  },

  baseUrl: String, // for OpenAI-compatible API endpoints (Ollama, etc.)

  models: [String], // z.B. ['gpt-4.1', 'llama3']

}, { timestamps: true });

export default mongoose.models.ApiKey || mongoose.model('ApiKey', apiKeySchema);