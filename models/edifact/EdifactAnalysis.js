import mongoose from 'mongoose';

export const edifactAnalysisSchema = new mongoose.Schema({
    // ===== Interchange Envelope (UNB/UNZ) =====
    interchange: {
        sender: String,           // UNB+UNOC:3+SENDER
        receiver: String,         // UNB+...+RECEIVER
        controlReference: String, // UNB Control Ref
        syntaxIdentifier: String, // UNOC:3, UNOA:1
        syntaxVersion: String,    // Version number
        testIndicator: Boolean,   // Test flag
        dateTime: Date,           // Interchange timestamp
        recipientRef: String,     // Recipient reference
        applicationRef: String    // Application reference
    },

    // ===== Message Header (UNH) =====
    messageHeader: {
        messageReference: String,   // UNH+123
        messageType: String,        // INVOIC
        messageVersion: String,     // D
        messageRelease: String,     // 96A
        controllingAgency: String,  // UN
        associationCode: String     // EAN, ODETTE, etc.
    },

    // ===== Segments (Enhanced) =====
    segments: [String],          // Backward compat: ['UNH','BGM','DTM']
    segmentCount: Number,

    segmentDetails: [{           // NEW: Detailed segment info
        tag: String,             // 'BGM'
        position: Number,        // Line number in file
        content: String,         // Full segment text
        fields: [String],        // Parsed fields
        hasErrors: Boolean,
        errorDetails: [String]         // Segment-specific validation errordetails
    }],

    // ===== Validation Results =====
    validation: {
        errorCount: { type: Number, default: 0 },
        warningCount: { type: Number, default: 0 },
        details: [{
            segment: String,     // Segment tag or position
            field: String,       // Field identifier
            code: String,        // Error code (e.g., MISSING_UNB)
            error: String,       // Error message
            warning: String,     // Warning message
            severity: {
                type: String,
                enum: ['error', 'warning', 'info']
            },
            line: Number,
            suggestion: String   // Fix suggestion
        }]
    },

    // ===== Business Content (Extracted) =====
    businessData: {
        documentNumber: String,    // BGM Document ID
        documentType: String,      // Invoice, Order, etc.
        documentDate: Date,        // BGM Date
        documentFunction: String,  // Original, Copy, etc.

        currency: String,          // CUX Currency code (EUR, USD)
        totalAmount: Number,       // MOA Total monetary amount
        taxAmount: Number,         // MOA Tax amount
        netAmount: Number,         // MOA Net amount

        lineItemCount: Number,     // Number of LIN segments

        dates: [{                  // DTM segments
            qualifier: String,     // 137 (Document date), 35 (Delivery)
            date: Date,
            format: String         // 102, 203, etc.
        }],

        references: [{             // RFF segments
            qualifier: String,     // ON (Order number), IV (Invoice)
            value: String
        }]
    },

    // ===== Parties (Enhanced) =====
    parties: [{
        qualifier: String,         // BY (Buyer), SU (Supplier), DP (Delivery)
        id: String,                // GLN, ILN, DUNS
        idType: String,            // 9 (GLN), 14 (EAN)
        name: String,              // NAD Name
        address: {
            street: [String],      // NAD Street lines
            city: String,
            postalCode: String,
            countryCode: String,   // ISO 3166
            region: String
        },
        contact: {
            name: String,          // CTA Contact name
            phone: String,         // COM Phone
            email: String,         // COM Email
            fax: String
        }
    }],

    // ===== Compliance & Standards =====
    compliance: {
        standard: String,          // UN/EDIFACT, EANCOM, ODETTE
        subset: String,            // Detected subset (may differ from user input)
        version: String,           // Message version
        isCompliant: Boolean,      // Overall compliance

        requiredSegments: [String],  // Per standard
        missingSegments: [String],   // Compliance violations
        unexpectedSegments: [String],

        mandatoryFieldsMissing: [{
            segment: String,
            field: String,
            requirement: String
        }]
    },

    // ===== Processing Metadata =====
    processing: {
        parsingDuration: Number,      // ms
        validationDuration: Number,   // ms
        totalDuration: Number,        // ms

        fileSize: Number,             // bytes
        lineCount: Number,            // lines in file

        tokenCount: Number,           // Estimated tokens for LLM
        compressionRatio: Number,     // llmContext vs raw size

        truncated: Boolean,           // If segments were truncated
        truncatedAt: Number,          // Segment count limit

        rawPreview: String            // First 4000 chars
    },

    // ===== LLM Context (Optimized) =====
    summary: String,               // Human-readable summary
    llmContext: String,            // Token-optimized for LLM

    // ===== Status =====
    status: {
        type: String,
        enum: ['pending', 'parsed', 'validated', 'error'],
        default: 'pending'
    }
}, {
    timestamps: true, // Automatisch createdAt und updatedAt
    _id: false // Eingebettet im AnalysisChat, kein eigenes _id TODO: anatoli vielleicht eigene collection
});
export default mongoose.models.EdifactAnalysis || mongoose.model('EdifactAnalysis', edifactAnalysisSchema)