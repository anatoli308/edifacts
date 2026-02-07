import mongoose from 'mongoose';

const analysisChatSettingsSchema = new mongoose.Schema({
    language: {
        type: String,
        enum: ['automatic', 'en', 'de', 'fr', 'es', 'it', 'nl', 'pt'],
        default: 'automatic'
    },

    responseStyle: {
        type: String,
        enum: ['default', 'analyst', 'manager', 'business', 'tech'],
        default: 'default'
    },

    responseLength: {
        type: String,
        enum: ['short', 'balanced', 'detailed', 'expert'],
        default: 'balanced'
    },

    formatting: {
        headlinesAndLists: {
            type: String,
            enum: ['more', 'default', 'less'],
            default: 'default'
        },
        tables: {
            type: String,
            enum: ['more', 'default', 'less'],
            default: 'default'
        },
        chartsAndVisualizations: {
            type: String,
            enum: ['more', 'default', 'less'],
            default: 'default'
        },
        emojis: {
            type: String,
            enum: ['more', 'default', 'less'],
            default: 'default'
        }
    },

    personalizedBehavior: {
        type: String,
        default: '',
        maxlength: 2000
    },

    aboutYou: {
        nickname: {
            type: String,
            trim: true,
            default: '',
            maxlength: 50
        },
        occupation: {
            type: String,
            trim: true,
            default: '',
            maxlength: 100
        },
        aboutMe: {
            type: String,
            default: '',
            maxlength: 500
        }
    },

    memory: {
        useChatHistory: {
            type: Boolean,
            default: true
        },
        useSavedMemories: {
            type: Boolean,
            default: true
        }
    },

    advanced: {
        temperature: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.7
        },
        contextWindowSize: {
            type: Number,
            enum: [2000, 4000, 8000, 16000, 32000],
            default: 4000
        },
        internetSearch: {
            type: Boolean,
            default: true
        }
    }
}, { _id: false });

export { analysisChatSettingsSchema };
