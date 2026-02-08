/**
 * LLM-Generated EDI Analysis Tool
 * ================================
 * Allows the LLM to produce a structured EDI analysis object for formats
 * that the deterministic parsers (EDIFACT, X12) cannot handle.
 *
 * This serves as a universal fallback: the LLM reads the raw EDI message,
 * understands it, and fills in a structured JSON matching the EdifactAnalysis schema.
 * The frontend receives it via `_type: 'edifact_analysis'` and renders the panel.
 *
 * Supported use cases:
 * - NCPDP Telecommunications / D.0
 * - HL7 v2.x pipe-delimited messages
 * - TRADACOMS (STX=...)
 * - VDA (German automotive)
 * - Any proprietary or less common EDI format
 * - Fallback when deterministic detection fails
 *
 * The LLM fills the structured schema; this tool validates and normalizes it.
 *
 * v1.0
 */

// ==================== SCHEMA DEFAULTS ====================

/**
 * Default values for the analysis object.
 * Ensures the output always has the required shape even if
 * the LLM omits optional fields.
 * @private
 */
function _buildDefaults() {
    return {
        interchange: {
            sender: null,
            receiver: null,
            controlReference: null,
            syntaxIdentifier: null,
            syntaxVersion: null,
            testIndicator: false,
            dateTime: null,
            recipientRef: null,
            applicationRef: null
        },
        messageHeader: {
            messageReference: null,
            messageType: null,
            messageVersion: null,
            messageRelease: null,
            controllingAgency: null,
            associationCode: null
        },
        segments: [],
        segmentCount: 0,
        segmentDetails: [],
        validation: {
            errorCount: 0,
            warningCount: 0,
            details: []
        },
        businessData: {
            documentNumber: null,
            documentType: null,
            documentDate: null,
            documentFunction: null,
            currency: null,
            totalAmount: null,
            taxAmount: null,
            netAmount: null,
            lineItemCount: null,
            dates: [],
            references: []
        },
        parties: [],
        compliance: {
            standard: null,
            subset: null,
            version: null,
            isCompliant: null,
            requiredSegments: [],
            missingSegments: [],
            unexpectedSegments: [],
            mandatoryFieldsMissing: []
        },
        processing: {
            parsingDuration: 0,
            validationDuration: 0,
            totalDuration: 0,
            fileSize: 0,
            lineCount: 0,
            tokenCount: 0,
            compressionRatio: 0,
            truncated: false,
            truncatedAt: null,
            rawPreview: ''
        },
        summary: '',
        llmContext: '',
        status: 'parsed'
    };
}

// ==================== VALIDATION & NORMALIZATION ====================

/**
 * Safely parse a date value from the LLM.
 * Accepts ISO strings, common date formats, or null.
 * @param {*} value - Date value from LLM
 * @returns {Date|null}
 * @private
 */
function _safeDate(value) {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === 'string') {
        const parsed = new Date(value);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
}

/**
 * Ensure a value is an array.
 * @private
 */
function _ensureArray(value) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return [];
    return [value];
}

/**
 * Ensure a value is a non-negative number.
 * @private
 */
function _ensureNumber(value, fallback = 0) {
    const num = Number(value);
    return isNaN(num) ? fallback : Math.max(0, num);
}

/**
 * Normalize a validation detail entry from LLM input.
 * @private
 */
function _normalizeValidationDetail(detail) {
    if (!detail || typeof detail !== 'object') return null;
    return {
        segment: detail.segment || null,
        field: detail.field || null,
        code: detail.code || null,
        error: detail.error || null,
        warning: detail.warning || null,
        severity: ['error', 'warning', 'info'].includes(detail.severity) ? detail.severity : 'info',
        line: _ensureNumber(detail.line, null),
        suggestion: detail.suggestion || null
    };
}

/**
 * Normalize a segment detail entry from LLM input.
 * @private
 */
function _normalizeSegmentDetail(detail) {
    if (!detail || typeof detail !== 'object') return null;
    return {
        tag: detail.tag || '',
        position: _ensureNumber(detail.position, 0),
        content: detail.content || '',
        fields: _ensureArray(detail.fields),
        hasErrors: Boolean(detail.hasErrors),
        errorDetails: _ensureArray(detail.errorDetails)
    };
}

/**
 * Normalize a party entry from LLM input.
 * @private
 */
function _normalizeParty(party) {
    if (!party || typeof party !== 'object') return null;
    return {
        qualifier: party.qualifier || null,
        id: party.id || null,
        idType: party.idType || null,
        name: party.name || null,
        address: party.address ? {
            street: _ensureArray(party.address.street),
            city: party.address.city || null,
            postalCode: party.address.postalCode || null,
            countryCode: party.address.countryCode || null,
            region: party.address.region || null
        } : undefined,
        contact: party.contact ? {
            name: party.contact.name || null,
            phone: party.contact.phone || null,
            email: party.contact.email || null,
            fax: party.contact.fax || null
        } : undefined
    };
}

/**
 * Normalize a business data date entry.
 * @private
 */
function _normalizeBusinessDate(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const date = _safeDate(entry.date);
    if (!date) return null;
    return {
        qualifier: entry.qualifier || null,
        date,
        format: entry.format || null
    };
}

/**
 * Auto-extract segments and segmentDetails from raw EDI content.
 * Used as fallback when the LLM does not provide segments.
 * Splits on common delimiters (newlines, ~, ') and extracts tag-like prefixes.
 * @param {string} rawContent
 * @returns {{ segments: string[], segmentDetails: object[] }}
 * @private
 */
function _autoExtractSegments(rawContent) {
    if (!rawContent || typeof rawContent !== 'string') return { segments: [], segmentDetails: [] };

    // Try common EDI segment terminators: ~ (X12), ' (EDIFACT), \r\n, \n
    let lines;
    if (rawContent.includes('~')) {
        lines = rawContent.split('~').map(l => l.trim()).filter(Boolean);
    } else if (rawContent.includes("'")) {
        lines = rawContent.split("'").map(l => l.trim()).filter(Boolean);
    } else {
        lines = rawContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    }

    const segments = [];
    const segmentDetails = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        // Extract tag: first token before delimiter (* + : | \t or whitespace for fixed-width)
        const tagMatch = line.match(/^([A-Z0-9]{2,10})[*+:|\t\s]/) || line.match(/^([A-Z]{2,4})/);
        const tag = tagMatch ? tagMatch[1] : `REC${i + 1}`;

        // Extract fields by common delimiters
        let fields;
        if (line.includes('*')) fields = line.split('*');
        else if (line.includes('+')) fields = line.split('+');
        else if (line.includes('|')) fields = line.split('|');
        else fields = [line];

        segments.push(tag);
        segmentDetails.push({
            tag,
            position: i + 1,
            content: line,
            fields: fields.map(f => f.trim()),
            hasErrors: false,
            errorDetails: []
        });
    }

    return { segments, segmentDetails };
}

/**
 * Merge LLM-provided analysis with defaults, normalizing all fields.
 * @param {object} llmAnalysis - Raw analysis object from the LLM
 * @param {string} rawContent - Original raw EDI content
 * @returns {object} Normalized analysis compatible with EdifactAnalysis schema
 * @private
 */
function _normalizeAnalysis(llmAnalysis, rawContent) {
    const defaults = _buildDefaults();
    const a = llmAnalysis || {};

    // Interchange
    const interchange = {
        ...defaults.interchange,
        ...(a.interchange || {}),
        dateTime: _safeDate(a.interchange?.dateTime),
        testIndicator: Boolean(a.interchange?.testIndicator)
    };

    // Message Header
    const messageHeader = {
        ...defaults.messageHeader,
        ...(a.messageHeader || {})
    };

    // Segments — use LLM-provided data, fallback to auto-extraction from rawContent
    let segments = _ensureArray(a.segments).filter(s => typeof s === 'string');
    let segmentDetails = _ensureArray(a.segmentDetails)
        .map(_normalizeSegmentDetail)
        .filter(Boolean);

    // Auto-extract from rawContent if LLM didn't provide segments
    if (segments.length === 0 && segmentDetails.length === 0 && rawContent) {
        const extracted = _autoExtractSegments(rawContent);
        segments = extracted.segments;
        segmentDetails = extracted.segmentDetails;
    } else if (segments.length > 0 && segmentDetails.length === 0 && rawContent) {
        // LLM provided tags but no details — build details from raw
        const extracted = _autoExtractSegments(rawContent);
        segmentDetails = extracted.segmentDetails;
    }

    const segmentCount = _ensureNumber(a.segmentCount, segments.length);

    // Validation
    const validationDetails = _ensureArray(a.validation?.details)
        .map(_normalizeValidationDetail)
        .filter(Boolean);
    const validation = {
        errorCount: _ensureNumber(a.validation?.errorCount, validationDetails.filter(d => d.severity === 'error').length),
        warningCount: _ensureNumber(a.validation?.warningCount, validationDetails.filter(d => d.severity === 'warning').length),
        details: validationDetails
    };

    // Business Data
    const dates = _ensureArray(a.businessData?.dates)
        .map(_normalizeBusinessDate)
        .filter(Boolean);
    const references = _ensureArray(a.businessData?.references)
        .filter(r => r && typeof r === 'object')
        .map(r => ({ qualifier: r.qualifier || null, value: r.value || null }));
    const businessData = {
        documentNumber: a.businessData?.documentNumber || null,
        documentType: a.businessData?.documentType || null,
        documentDate: _safeDate(a.businessData?.documentDate),
        documentFunction: a.businessData?.documentFunction || null,
        currency: a.businessData?.currency || null,
        totalAmount: a.businessData?.totalAmount != null ? Number(a.businessData.totalAmount) : null,
        taxAmount: a.businessData?.taxAmount != null ? Number(a.businessData.taxAmount) : null,
        netAmount: a.businessData?.netAmount != null ? Number(a.businessData.netAmount) : null,
        lineItemCount: a.businessData?.lineItemCount != null ? _ensureNumber(a.businessData.lineItemCount) : null,
        dates,
        references
    };

    // Parties
    const parties = _ensureArray(a.parties)
        .map(_normalizeParty)
        .filter(Boolean);

    // Compliance
    const compliance = {
        standard: a.compliance?.standard || null,
        subset: a.compliance?.subset || null,
        version: a.compliance?.version || null,
        isCompliant: a.compliance?.isCompliant != null ? Boolean(a.compliance.isCompliant) : null,
        requiredSegments: _ensureArray(a.compliance?.requiredSegments),
        missingSegments: _ensureArray(a.compliance?.missingSegments),
        unexpectedSegments: _ensureArray(a.compliance?.unexpectedSegments),
        mandatoryFieldsMissing: _ensureArray(a.compliance?.mandatoryFieldsMissing)
    };

    // Processing metadata
    const processing = {
        parsingDuration: 0,
        validationDuration: 0,
        totalDuration: 0,
        fileSize: rawContent ? Buffer.byteLength(rawContent, 'utf8') : 0,
        lineCount: rawContent ? rawContent.split('\n').length : 0,
        tokenCount: rawContent ? Math.ceil(rawContent.length / 4) : 0,
        compressionRatio: 0,
        truncated: false,
        truncatedAt: null,
        rawPreview: rawContent ? rawContent.substring(0, 4000) : ''
    };

    // LLM Context — build from the analysis itself
    const llmContext = _buildLLMContext({
        interchange, messageHeader, segmentCount, validation,
        businessData, parties, compliance
    });

    // Summary
    const summary = a.summary || `LLM-analyzed ${segmentCount} segments | ` +
        `Format: ${compliance.standard || 'Unknown'} | ` +
        `Type: ${messageHeader.messageType || 'Unknown'} | ` +
        `Errors: ${validation.errorCount} | Warnings: ${validation.warningCount}`;

    return {
        interchange,
        messageHeader,
        segments,
        segmentCount,
        segmentDetails,
        validation,
        businessData,
        parties,
        compliance,
        processing,
        llmContext,
        summary,
        status: 'parsed'
    };
}

/**
 * Build token-optimized LLM context string from analysis.
 * @private
 */
function _buildLLMContext(analysis) {
    const lines = [];
    lines.push(`## EDI Analysis (LLM-generated)`);

    const { interchange, messageHeader, segmentCount, validation, businessData, parties, compliance } = analysis;

    if (compliance?.standard) lines.push(`Standard: ${compliance.standard}`);
    if (messageHeader?.messageType) lines.push(`Type: ${messageHeader.messageType}`);
    if (messageHeader?.messageVersion) lines.push(`Version: ${messageHeader.messageVersion}${messageHeader.messageRelease ? `.${messageHeader.messageRelease}` : ''}`);

    lines.push(`Segments: ${segmentCount}`);

    if (interchange?.sender) lines.push(`Sender: ${interchange.sender}`);
    if (interchange?.receiver) lines.push(`Receiver: ${interchange.receiver}`);

    if (businessData?.documentNumber) lines.push(`Document: ${businessData.documentNumber}`);
    if (businessData?.documentType) lines.push(`Doc Type: ${businessData.documentType}`);
    if (businessData?.currency) lines.push(`Currency: ${businessData.currency}`);
    if (businessData?.totalAmount != null) lines.push(`Total: ${businessData.totalAmount}`);

    if (parties?.length > 0) {
        lines.push(`Parties: ${parties.map(p => `${p.qualifier || '?'}=${p.name || p.id || '?'}`).join(', ')}`);
    }

    if (validation?.errorCount > 0) {
        lines.push(`Errors: ${validation.errorCount}`);
        for (const d of (validation.details || []).slice(0, 5)) {
            if (d.severity === 'error') lines.push(`  - ${d.error || d.code || 'Unknown error'}`);
        }
    }
    if (validation?.warningCount > 0) {
        lines.push(`Warnings: ${validation.warningCount}`);
    }

    return lines.join('\n');
}

// ==================== TOOL: createEdiAnalysis ====================

/**
 * Tool: createEdiAnalysis
 *
 * Accepts a structured analysis JSON from the LLM for any EDI format.
 * Validates, normalizes, and returns it as `_type: 'edifact_analysis'`
 * so the frontend renders the analysis panel.
 *
 * Use when deterministic parsers cannot handle the format (HL7, NCPDP,
 * TRADACOMS, VDA, proprietary formats, etc.).
 */
export const createEdiAnalysis = {
    name: 'createEdiAnalysis',
    description: 'Create a structured EDI analysis for non-standard formats (HL7 v2, NCPDP, TRADACOMS, VDA, proprietary). Pass rawContent, format, and an analysis JSON with segments, segmentDetails, interchange, messageHeader, validation, businessData, parties, compliance. Segments are auto-extracted from rawContent if omitted. Use when NOT UN/EDIFACT or X12.',
    category: 'analysis',
    module: 'edifact',
    version: '1.0',
    inputSchema: {
        type: 'object',
        properties: {
            rawContent: {
                type: 'string',
                description: 'The raw EDI message content exactly as received.'
            },
            format: {
                type: 'string',
                description: 'The identified EDI format (e.g. "HL7v2", "NCPDP_Telco", "TRADACOMS", "VDA", "NCPDP_D0", "proprietary", etc.).'
            },
            analysis: {
                type: 'object',
                description: 'REQUIRED: The full structured analysis. You MUST fill interchange (sender/receiver), messageHeader (type/version), parties (all identified entities), businessData (documentType, dates, references, amounts), compliance (standard, isCompliant), and validation. Segments/segmentDetails are auto-extracted if omitted.',
                properties: {
                    interchange: {
                        type: 'object',
                        description: 'REQUIRED: Envelope/header — extract sender, receiver, controlReference from the message header.',
                        properties: {
                            sender: { type: 'string', description: 'Sending party identifier' },
                            receiver: { type: 'string', description: 'Receiving party identifier' },
                            controlReference: { type: 'string', description: 'Interchange control reference/number' },
                            syntaxIdentifier: { type: 'string', description: 'Syntax identifier (e.g. UNOC:3, HL7v2.5)' },
                            syntaxVersion: { type: 'string', description: 'Syntax/protocol version' },
                            testIndicator: { type: 'boolean', description: 'Whether this is a test message' },
                            dateTime: { type: 'string', description: 'Interchange date/time in ISO 8601 format' }
                        }
                    },
                    messageHeader: {
                        type: 'object',
                        description: 'REQUIRED: Message type — extract messageType, messageVersion, controllingAgency from the message.',
                        properties: {
                            messageReference: { type: 'string', description: 'Message reference number' },
                            messageType: { type: 'string', description: 'Message type code (e.g. ADT^A01, B1, ORDHDR)' },
                            messageVersion: { type: 'string', description: 'Version (e.g. 2.5, D.0, 9)' },
                            messageRelease: { type: 'string', description: 'Release number' },
                            controllingAgency: { type: 'string', description: 'Controlling agency (e.g. HL7, NCPDP, ANA)' },
                            associationCode: { type: 'string', description: 'Association/subset code' }
                        }
                    },
                    segments: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of ALL segment/record tags in order (e.g. ["MSH","PID","PV1"]). Auto-extracted from rawContent if omitted.'
                    },
                    segmentCount: {
                        type: 'number',
                        description: 'Total number of segments/records in the message.'
                    },
                    segmentDetails: {
                        type: 'array',
                        description: 'Detailed info per segment. Each entry needs tag, position, content (full text), and fields. Auto-extracted from rawContent if omitted.',
                        items: {
                            type: 'object',
                            properties: {
                                tag: { type: 'string' },
                                position: { type: 'number' },
                                content: { type: 'string', description: 'Full segment/record text' },
                                fields: { type: 'array', items: { type: 'string' } },
                                hasErrors: { type: 'boolean' },
                                errorDetails: { type: 'array', items: { type: 'string' } }
                            }
                        }
                    },
                    validation: {
                        type: 'object',
                        description: 'REQUIRED: Validate the message structure. Set errorCount, warningCount, and list specific issues in details array with severity, segment, and error message.',
                        properties: {
                            errorCount: { type: 'number' },
                            warningCount: { type: 'number' },
                            details: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        segment: { type: 'string' },
                                        field: { type: 'string' },
                                        code: { type: 'string' },
                                        error: { type: 'string' },
                                        warning: { type: 'string' },
                                        severity: { type: 'string', enum: ['error', 'warning', 'info'] },
                                        line: { type: 'number' },
                                        suggestion: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    businessData: {
                        type: 'object',
                        description: 'REQUIRED: Extract ALL business content — documentType, documentNumber, dates (with qualifiers), references, amounts, currency. Identify every date/reference/amount in the message.',
                        properties: {
                            documentNumber: { type: 'string' },
                            documentType: { type: 'string', description: 'E.g. Claim, Enrollment, Eligibility, ADT, Order' },
                            documentDate: { type: 'string', description: 'Document date in ISO 8601' },
                            documentFunction: { type: 'string' },
                            currency: { type: 'string' },
                            totalAmount: { type: 'number' },
                            taxAmount: { type: 'number' },
                            netAmount: { type: 'number' },
                            lineItemCount: { type: 'number' },
                            dates: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        qualifier: { type: 'string' },
                                        date: { type: 'string', description: 'ISO 8601 date string' },
                                        format: { type: 'string' }
                                    }
                                }
                            },
                            references: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        qualifier: { type: 'string' },
                                        value: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    parties: {
                        type: 'array',
                        description: 'REQUIRED: ALL parties/entities — extract every sender, receiver, patient, provider, payer, employer, etc. with qualifier, id, name, and address if available.',
                        items: {
                            type: 'object',
                            properties: {
                                qualifier: { type: 'string', description: 'Role (e.g. BY, SU, sender, receiver, patient, provider)' },
                                id: { type: 'string' },
                                idType: { type: 'string' },
                                name: { type: 'string' },
                                address: {
                                    type: 'object',
                                    properties: {
                                        street: { type: 'array', items: { type: 'string' } },
                                        city: { type: 'string' },
                                        postalCode: { type: 'string' },
                                        countryCode: { type: 'string' },
                                        region: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    compliance: {
                        type: 'object',
                        description: 'REQUIRED: Set standard name, version, and isCompliant (true/false based on your analysis). List any missing required segments.',
                        properties: {
                            standard: { type: 'string', description: 'Standard name (e.g. HL7 v2.5, NCPDP Telecommunications, TRADACOMS)' },
                            subset: { type: 'string' },
                            version: { type: 'string' },
                            isCompliant: { type: 'boolean' },
                            requiredSegments: { type: 'array', items: { type: 'string' } },
                            missingSegments: { type: 'array', items: { type: 'string' } }
                        }
                    },
                    summary: {
                        type: 'string',
                        description: 'Human-readable summary of the analysis.'
                    }
                }
            }
        },
        required: ['rawContent', 'format', 'analysis']
    },
    execute: async (args) => {
        const startTime = Date.now();
        const { rawContent, format, analysis: llmAnalysis } = args;

        if (!rawContent || typeof rawContent !== 'string') {
            return { success: false, error: 'rawContent is required and must be a string' };
        }

        if (!format || typeof format !== 'string') {
            return { success: false, error: 'format is required (e.g. "HL7v2", "NCPDP_Telco", "TRADACOMS")' };
        }

        if (!llmAnalysis || typeof llmAnalysis !== 'object') {
            return { success: false, error: 'analysis object is required' };
        }

        // Normalize and validate the LLM-provided analysis
        const normalizedAnalysis = _normalizeAnalysis(llmAnalysis, rawContent);

        // Set the compliance standard to the detected format if not provided
        if (!normalizedAnalysis.compliance.standard) {
            normalizedAnalysis.compliance.standard = format;
        }

        // Update processing metadata
        normalizedAnalysis.processing.totalDuration = Date.now() - startTime;

        console.log(`[createEdiAnalysis] LLM-generated analysis for format "${format}": ${normalizedAnalysis.segmentCount} segments, ${normalizedAnalysis.validation.errorCount} errors`);

        return {
            _type: 'edifact_analysis',
            analysis: normalizedAnalysis,
            extractedRaw: rawContent,
            format,
            source: 'llm',
            summary: normalizedAnalysis.summary
        };
    }
};
