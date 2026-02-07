/**
 * EDIFACT Analysis Builder
 * ========================
 * Deterministic builder that converts parsed EDIFACT segments
 * into a rich analysis object matching EdifactAnalysis schema.
 *
 * Pure function - no side effects, no DB access, no LLM calls.
 * Designed to run inside worker_threads.
 */

// ==================== SEGMENT PARSERS ====================

/**
 * Parse UNA service string (defines delimiters)
 * @param {string} raw - Raw file content
 * @returns {object} Delimiter config
 */
function _parseUNA(raw) {
    const defaults = {
        componentSeparator: ':',
        fieldSeparator: '+',
        decimalNotation: '.',
        escapeCharacter: '?',
        reserved: ' ',
        segmentTerminator: "'",
        hasUNA: false
    };

    if (raw.startsWith('UNA')) {
        return {
            componentSeparator: raw[3] || defaults.componentSeparator,
            fieldSeparator: raw[4] || defaults.fieldSeparator,
            decimalNotation: raw[5] || defaults.decimalNotation,
            escapeCharacter: raw[6] || defaults.escapeCharacter,
            reserved: raw[7] || defaults.reserved,
            segmentTerminator: raw[8] || defaults.segmentTerminator,
            hasUNA: true
        };
    }

    return defaults;
}

/**
 * Split raw content into segments, respecting escape characters
 * @param {string} raw - Raw EDIFACT content
 * @param {object} delimiters - Parsed delimiters
 * @returns {string[]} Array of segment strings
 */
function _splitSegments(raw, delimiters) {
    const { segmentTerminator, escapeCharacter } = delimiters;
    const segments = [];
    let current = '';

    // Skip UNA if present
    let startIndex = 0;
    if (raw.startsWith('UNA')) {
        startIndex = 9; // UNA + 6 chars + possible newline
        // Skip newlines/whitespace after UNA
        while (startIndex < raw.length && (raw[startIndex] === '\n' || raw[startIndex] === '\r')) {
            startIndex++;
        }
    }

    for (let i = startIndex; i < raw.length; i++) {
        const char = raw[i];

        // Check for escaped terminator
        if (char === escapeCharacter && i + 1 < raw.length && raw[i + 1] === segmentTerminator) {
            current += segmentTerminator;
            i++; // Skip next char
            continue;
        }

        if (char === segmentTerminator) {
            const trimmed = current.trim();
            if (trimmed.length > 0) {
                segments.push(trimmed);
            }
            current = '';
            continue;
        }

        // Skip line breaks (EDIFACT ignores them)
        if (char === '\n' || char === '\r') {
            continue;
        }

        current += char;
    }

    // Handle last segment (if no terminator at end)
    const trimmed = current.trim();
    if (trimmed.length > 0) {
        segments.push(trimmed);
    }

    return segments;
}

/**
 * Parse a segment into tag and fields
 * @param {string} segmentStr - Raw segment string
 * @param {object} delimiters - Parsed delimiters
 * @returns {object} { tag, fields: [{ value, components: [] }] }
 */
function _parseSegment(segmentStr, delimiters) {
    const { fieldSeparator, componentSeparator, escapeCharacter } = delimiters;

    // Split by field separator (respecting escape)
    const fields = _splitWithEscape(segmentStr, fieldSeparator, escapeCharacter);
    const tag = fields[0] || '';

    const parsedFields = fields.slice(1).map((field, index) => {
        const components = _splitWithEscape(field, componentSeparator, escapeCharacter);
        return {
            index,
            value: field,
            components,
            isComposite: components.length > 1
        };
    });

    return { tag, fields: parsedFields, raw: segmentStr };
}

/**
 * Split string by delimiter respecting escape character
 */
function _splitWithEscape(str, delimiter, escape) {
    const parts = [];
    let current = '';

    for (let i = 0; i < str.length; i++) {
        if (str[i] === escape && i + 1 < str.length && str[i + 1] === delimiter) {
            current += delimiter;
            i++;
            continue;
        }
        if (str[i] === delimiter) {
            parts.push(current);
            current = '';
            continue;
        }
        current += str[i];
    }
    parts.push(current);
    return parts;
}

// ==================== DATA EXTRACTORS ====================

/**
 * Extract interchange data from UNB segment
 */
function _extractInterchange(unbSegment) {
    if (!unbSegment) return null;

    const f = unbSegment.fields;

    // UNB+syntax:version+sender:qualifier+receiver:qualifier+date:time+controlRef+...
    const syntaxField = f[0]?.components || [];
    const senderField = f[1]?.components || [];
    const receiverField = f[2]?.components || [];
    const dateTimeField = f[3]?.components || [];
    const controlRef = f[4]?.value || '';

    // Parse date + time into Date object
    let dateTime = null;
    if (dateTimeField[0]) {
        const dateStr = dateTimeField[0];
        const timeStr = dateTimeField[1] || '0000';
        try {
            // EDIFACT dates: YYMMDD or YYYYMMDD
            const year = dateStr.length === 6 ? '20' + dateStr.slice(0, 2) : dateStr.slice(0, 4);
            const month = dateStr.slice(-4, -2);
            const day = dateStr.slice(-2);
            const hour = timeStr.slice(0, 2);
            const minute = timeStr.slice(2, 4);
            dateTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
            if (isNaN(dateTime.getTime())) dateTime = null;
        } catch {
            dateTime = null;
        }
    }

    return {
        sender: senderField[0] || '',
        receiver: receiverField[0] || '',
        controlReference: controlRef,
        syntaxIdentifier: syntaxField[0] || '',
        syntaxVersion: syntaxField[1] || '',
        testIndicator: (f[10]?.value === '1') || false,
        dateTime,
        recipientRef: f[5]?.value || '',
        applicationRef: f[6]?.value || ''
    };
}

/**
 * Extract message header from UNH segment
 */
function _extractMessageHeader(unhSegment) {
    if (!unhSegment) return null;

    const f = unhSegment.fields;
    // UNH+messageRef+type:version:release:agency:associationCode
    const messageRef = f[0]?.value || '';
    const typeField = f[1]?.components || [];

    return {
        messageReference: messageRef,
        messageType: typeField[0] || '',
        messageVersion: typeField[1] || '',
        messageRelease: typeField[2] || '',
        controllingAgency: typeField[3] || '',
        associationCode: typeField[4] || ''
    };
}

/**
 * Extract business data from BGM, DTM, MOA, CUX, RFF, LIN segments
 */
function _extractBusinessData(parsedSegments) {
    const business = {
        documentNumber: '',
        documentType: '',
        documentDate: null,
        documentFunction: '',
        currency: '',
        totalAmount: null,
        taxAmount: null,
        netAmount: null,
        lineItemCount: 0,
        dates: [],
        references: []
    };

    for (const seg of parsedSegments) {
        switch (seg.tag) {
            case 'BGM': {
                // BGM+docType+docNumber+functionCode
                const docTypeField = seg.fields[0]?.components || [];
                business.documentType = docTypeField[0] || '';
                business.documentNumber = seg.fields[1]?.value || '';
                business.documentFunction = seg.fields[2]?.value || '';
                break;
            }
            case 'DTM': {
                // DTM+qualifier:value:format
                const dtmField = seg.fields[0]?.components || [];
                const qualifier = dtmField[0] || '';
                const dateValue = dtmField[1] || '';
                const format = dtmField[2] || '';

                const parsedDate = _parseEdifactDate(dateValue, format);
                business.dates.push({ qualifier, date: parsedDate, format });

                // Document date (qualifier 137 or 3)
                if ((qualifier === '137' || qualifier === '3') && !business.documentDate) {
                    business.documentDate = parsedDate;
                }
                break;
            }
            case 'CUX': {
                // CUX+qualifier:currencyCode:...
                const cuxField = seg.fields[0]?.components || [];
                business.currency = cuxField[1] || '';
                break;
            }
            case 'MOA': {
                // MOA+qualifier:amount:currency
                const moaField = seg.fields[0]?.components || [];
                const qualifier = moaField[0] || '';
                const amount = parseFloat(moaField[1]) || 0;

                // 9 = total, 39 = total, 79 = total, 86 = tax, 124 = tax, 125 = net
                if (['9', '39', '79', '86', '124', '125', '203'].includes(qualifier)) {
                    if (['9', '39', '79'].includes(qualifier)) business.totalAmount = amount;
                    if (['86', '124'].includes(qualifier)) business.taxAmount = amount;
                    if (qualifier === '125') business.netAmount = amount;
                }
                break;
            }
            case 'RFF': {
                // RFF+qualifier:value
                const rffField = seg.fields[0]?.components || [];
                business.references.push({
                    qualifier: rffField[0] || '',
                    value: rffField[1] || ''
                });
                break;
            }
            case 'LIN': {
                business.lineItemCount++;
                break;
            }
        }
    }

    return business;
}

/**
 * Extract parties from NAD segments (with following CTA/COM)
 */
function _extractParties(parsedSegments) {
    const parties = [];
    let currentParty = null;

    for (const seg of parsedSegments) {
        if (seg.tag === 'NAD') {
            // Save previous party
            if (currentParty) parties.push(currentParty);

            // NAD+qualifier+id:qualifier:idType++name+street+city++postalCode+countryCode
            const qualifier = seg.fields[0]?.value || '';
            const idField = seg.fields[1]?.components || [];
            const nameField = seg.fields[3]?.components || [];
            const streetField = seg.fields[4]?.components || [];
            const cityField = seg.fields[5]?.components || [];
            const postalField = seg.fields[7]?.components || [];
            const countryField = seg.fields[8]?.components || [];

            currentParty = {
                qualifier,
                id: idField[0] || '',
                idType: idField[2] || '',
                name: nameField.filter(Boolean).join(' '),
                address: {
                    street: streetField.filter(Boolean),
                    city: cityField[0] || '',
                    postalCode: postalField[0] || '',
                    countryCode: countryField[0] || '',
                    region: ''
                },
                contact: {
                    name: '',
                    phone: '',
                    email: '',
                    fax: ''
                }
            };
        } else if (seg.tag === 'CTA' && currentParty) {
            // CTA+qualifier+name
            const ctaName = seg.fields[1]?.components || [];
            currentParty.contact.name = ctaName.filter(Boolean).join(' ');
        } else if (seg.tag === 'COM' && currentParty) {
            // COM+number:qualifier
            const comField = seg.fields[0]?.components || [];
            const comValue = comField[0] || '';
            const comType = comField[1] || '';

            switch (comType) {
                case 'TE': currentParty.contact.phone = comValue; break;
                case 'EM': currentParty.contact.email = comValue; break;
                case 'FX': currentParty.contact.fax = comValue; break;
            }
        } else if (seg.tag !== 'RFF' && currentParty && !['CTA', 'COM', 'RFF'].includes(seg.tag)) {
            // New segment group - save current party
            parties.push(currentParty);
            currentParty = null;
        }
    }

    // Save last party
    if (currentParty) parties.push(currentParty);

    return parties;
}

// ==================== VALIDATION ====================

/**
 * Basic structural validation
 */
function _validateStructure(parsedSegments, delimiters) {
    const details = [];
    let errorCount = 0;
    let warningCount = 0;

    const segmentTags = parsedSegments.map(s => s.tag);
    const hasUNB = segmentTags.includes('UNB');
    const hasUNZ = segmentTags.includes('UNZ');
    const hasUNH = segmentTags.includes('UNH');
    const hasUNT = segmentTags.includes('UNT');
    const hasBGM = segmentTags.includes('BGM');

    // Required envelope segments
    if (!hasUNB) {
        details.push({
            segment: 'UNB', code: 'MISSING_UNB',
            error: 'Missing interchange header (UNB)', severity: 'error',
            suggestion: 'Add UNB segment at the beginning of the interchange'
        });
        errorCount++;
    }
    if (!hasUNZ) {
        details.push({
            segment: 'UNZ', code: 'MISSING_UNZ',
            error: 'Missing interchange trailer (UNZ)', severity: 'error',
            suggestion: 'Add UNZ segment at the end of the interchange'
        });
        errorCount++;
    }
    if (!hasUNH) {
        details.push({
            segment: 'UNH', code: 'MISSING_UNH',
            error: 'Missing message header (UNH)', severity: 'error',
            suggestion: 'Add UNH segment before message content'
        });
        errorCount++;
    }
    if (!hasUNT) {
        details.push({
            segment: 'UNT', code: 'MISSING_UNT',
            error: 'Missing message trailer (UNT)', severity: 'error',
            suggestion: 'Add UNT segment at the end of each message'
        });
        errorCount++;
    }
    if (!hasBGM) {
        details.push({
            segment: 'BGM', code: 'MISSING_BGM',
            error: 'Missing beginning of message (BGM)', severity: 'warning',
            suggestion: 'Add BGM segment to specify document type and number'
        });
        warningCount++;
    }

    // UNT segment count validation
    const untSegment = parsedSegments.find(s => s.tag === 'UNT');
    if (untSegment) {
        const declaredCount = parseInt(untSegment.fields[0]?.value, 10);
        // Count segments between UNH and UNT (inclusive)
        const unhIndex = segmentTags.indexOf('UNH');
        const untIndex = segmentTags.indexOf('UNT');
        if (unhIndex >= 0 && untIndex > unhIndex) {
            const actualCount = untIndex - unhIndex + 1;
            if (declaredCount && declaredCount !== actualCount) {
                details.push({
                    segment: 'UNT', code: 'SEGMENT_COUNT_MISMATCH',
                    error: `UNT declares ${declaredCount} segments but found ${actualCount}`,
                    severity: 'warning',
                    suggestion: `Update UNT segment count to ${actualCount}`
                });
                warningCount++;
            }
        }
    }

    // UNZ message count validation
    const unzSegment = parsedSegments.find(s => s.tag === 'UNZ');
    if (unzSegment) {
        const declaredMsgCount = parseInt(unzSegment.fields[0]?.value, 10);
        const unhCount = segmentTags.filter(t => t === 'UNH').length;
        if (declaredMsgCount && declaredMsgCount !== unhCount) {
            details.push({
                segment: 'UNZ', code: 'MESSAGE_COUNT_MISMATCH',
                error: `UNZ declares ${declaredMsgCount} messages but found ${unhCount}`,
                severity: 'warning',
                suggestion: `Update UNZ message count to ${unhCount}`
            });
            warningCount++;
        }
    }

    // Check for unknown/unusual segment tags
    const knownTags = new Set([
        'UNA', 'UNB', 'UNH', 'UNT', 'UNZ', 'UNS', 'UNG', 'UNE',
        'BGM', 'DTM', 'MOA', 'RFF', 'NAD', 'CTA', 'COM', 'CUX',
        'LIN', 'PIA', 'IMD', 'QTY', 'PRI', 'ALI', 'ALC', 'TAX',
        'FTX', 'TDT', 'LOC', 'PAT', 'PCD', 'GIN', 'GIR', 'MEA',
        'SCC', 'CNT', 'TOD', 'EQD', 'SEL', 'PAC', 'PCI', 'RNG',
        'DOC', 'STS', 'IDE', 'TSR', 'FII', 'MOA', 'DGS', 'ERP',
        'RCS', 'AJT'
    ]);

    for (const seg of parsedSegments) {
        if (!knownTags.has(seg.tag) && seg.tag.length === 3) {
            details.push({
                segment: seg.tag, code: 'UNKNOWN_SEGMENT',
                warning: `Unknown segment tag: ${seg.tag}`, severity: 'info',
                suggestion: 'Verify segment tag is correct for this message type'
            });
        }
    }

    return { errorCount, warningCount, details };
}

// ==================== COMPLIANCE ====================

/**
 * Build compliance info
 */
function _buildCompliance(parsedSegments, messageHeader, userContext) {
    const segmentTags = parsedSegments.map(s => s.tag);
    const uniqueTags = [...new Set(segmentTags)];

    // Determine standard from UNH or user context
    let standard = 'UN/EDIFACT';
    if (messageHeader?.associationCode) {
        if (messageHeader.associationCode.includes('EAN')) standard = 'EANCOM';
        else if (messageHeader.associationCode.includes('ODETTE')) standard = 'ODETTE';
    }

    const subset = userContext?.subset || messageHeader?.associationCode || '';
    const version = messageHeader
        ? `${messageHeader.messageVersion}${messageHeader.messageRelease}`
        : '';

    // Required segments per standard (simplified)
    const requiredSegments = ['UNB', 'UNH', 'BGM', 'UNT', 'UNZ'];
    const missingSegments = requiredSegments.filter(tag => !segmentTags.includes(tag));
    const unexpectedSegments = uniqueTags.filter(tag => {
        // Flag segments that appear in unusual positions
        return false; // Simplified - would need message-specific rules
    });

    return {
        standard,
        subset,
        version,
        isCompliant: missingSegments.length === 0,
        requiredSegments,
        missingSegments,
        unexpectedSegments,
        mandatoryFieldsMissing: []
    };
}

// ==================== CONTEXT BUILDER ====================

/**
 * Build LLM-optimized context string
 */
function _buildLLMContext(analysis) {
    const lines = [];

    lines.push(`## EDIFACT Analysis`);
    lines.push(`Type: ${analysis.messageHeader?.messageType || 'Unknown'} (${analysis.compliance?.standard || 'UN/EDIFACT'} ${analysis.compliance?.version || ''})`);
    lines.push(`Segments: ${analysis.segmentCount} | Lines: ${analysis.processing?.lineCount || 'N/A'}`);

    if (analysis.interchange) {
        lines.push(`Sender: ${analysis.interchange.sender} | Receiver: ${analysis.interchange.receiver}`);
    }

    if (analysis.businessData) {
        const bd = analysis.businessData;
        if (bd.documentNumber) lines.push(`Document: ${bd.documentType} #${bd.documentNumber}`);
        if (bd.currency) lines.push(`Currency: ${bd.currency}`);
        if (bd.totalAmount !== null) lines.push(`Total: ${bd.totalAmount}`);
        if (bd.lineItemCount > 0) lines.push(`Line Items: ${bd.lineItemCount}`);
    }

    if (analysis.parties?.length > 0) {
        lines.push(`\nParties:`);
        for (const p of analysis.parties) {
            const label = _partyQualifierLabel(p.qualifier);
            lines.push(`- ${label}: ${p.name || p.id} (${p.qualifier})`);
        }
    }

    if (analysis.validation?.errorCount > 0 || analysis.validation?.warningCount > 0) {
        lines.push(`\nValidation: ${analysis.validation.errorCount} errors, ${analysis.validation.warningCount} warnings`);
        for (const d of (analysis.validation.details || []).slice(0, 10)) {
            const msg = d.error || d.warning || '';
            lines.push(`- [${d.severity}] ${d.segment}: ${msg}`);
        }
    }

    // Segment overview (grouped)
    const tagCounts = {};
    for (const seg of (analysis.segmentDetails || [])) {
        tagCounts[seg.tag] = (tagCounts[seg.tag] || 0) + 1;
    }
    if (Object.keys(tagCounts).length > 0) {
        lines.push(`\nSegment Distribution: ${Object.entries(tagCounts).map(([k, v]) => `${k}(${v})`).join(', ')}`);
    }

    return lines.join('\n');
}

/**
 * Build human-readable summary
 */
function _buildSummary(analysis) {
    const parts = [];

    const msgType = analysis.messageHeader?.messageType || 'Unknown';
    const standard = analysis.compliance?.standard || 'UN/EDIFACT';
    parts.push(`${standard} ${msgType} message`);

    if (analysis.compliance?.version) {
        parts.push(`version ${analysis.compliance.version}`);
    }

    parts.push(`with ${analysis.segmentCount} segments`);

    if (analysis.businessData?.documentNumber) {
        parts.push(`- Document #${analysis.businessData.documentNumber}`);
    }

    if (analysis.parties?.length > 0) {
        const sender = analysis.parties.find(p => ['SE', 'SU'].includes(p.qualifier));
        const receiver = analysis.parties.find(p => ['BY', 'MR'].includes(p.qualifier));
        if (sender) parts.push(`from ${sender.name || sender.id}`);
        if (receiver) parts.push(`to ${receiver.name || receiver.id}`);
    }

    if (analysis.validation?.errorCount > 0) {
        parts.push(`| ${analysis.validation.errorCount} validation errors found`);
    }

    return parts.join(' ');
}

// ==================== HELPERS ====================

function _parseEdifactDate(dateStr, format) {
    if (!dateStr) return null;

    try {
        switch (format) {
            case '102': { // CCYYMMDD
                const y = dateStr.slice(0, 4);
                const m = dateStr.slice(4, 6);
                const d = dateStr.slice(6, 8);
                return new Date(`${y}-${m}-${d}T00:00:00Z`);
            }
            case '203': { // CCYYMMDDHHMM
                const y = dateStr.slice(0, 4);
                const m = dateStr.slice(4, 6);
                const d = dateStr.slice(6, 8);
                const h = dateStr.slice(8, 10);
                const min = dateStr.slice(10, 12);
                return new Date(`${y}-${m}-${d}T${h}:${min}:00Z`);
            }
            default: {
                // Try YYMMDD
                if (dateStr.length === 6) {
                    const y = '20' + dateStr.slice(0, 2);
                    const m = dateStr.slice(2, 4);
                    const d = dateStr.slice(4, 6);
                    return new Date(`${y}-${m}-${d}T00:00:00Z`);
                }
                // Try CCYYMMDD
                if (dateStr.length === 8) {
                    const y = dateStr.slice(0, 4);
                    const m = dateStr.slice(4, 6);
                    const d = dateStr.slice(6, 8);
                    return new Date(`${y}-${m}-${d}T00:00:00Z`);
                }
                return null;
            }
        }
    } catch {
        return null;
    }
}

function _partyQualifierLabel(qualifier) {
    const labels = {
        'BY': 'Buyer', 'SE': 'Seller', 'SU': 'Supplier',
        'DP': 'Delivery Party', 'IV': 'Invoicee', 'MR': 'Message Recipient',
        'MS': 'Message Sender', 'PE': 'Payee', 'PR': 'Payer',
        'ST': 'Ship To', 'SF': 'Ship From', 'UC': 'Ultimate Consignee',
        'CN': 'Consignee', 'CZ': 'Consignor', 'CA': 'Carrier',
        'FW': 'Freight Forwarder', 'II': 'Issuer of Invoice'
    };
    return labels[qualifier] || qualifier;
}

/**
 * Estimate token count for LLM context
 * @param {string} text
 * @returns {number}
 */
function _estimateTokens(text) {
    if (!text) return 0;
    // Rough: ~4 chars per token for English/technical text
    return Math.ceil(text.length / 4);
}

// ==================== MAIN BUILDER ====================

/**
 * Build complete _analysis object from raw EDIFACT file content
 *
 * @param {string} rawContent - Raw EDIFACT file content
 * @param {object} fileInfo - { path, originalName, size }
 * @param {object} userContext - { subset, messageType, releaseVersion, standardFamily }
 * @returns {object} Analysis matching EdifactAnalysis schema
 */
export function buildAnalysis(rawContent, fileInfo, userContext = {}) {
    const startTime = Date.now();

    // 1. Parse delimiters (UNA)
    const delimiters = _parseUNA(rawContent);

    // 2. Split into segments
    const segmentStrings = _splitSegments(rawContent, delimiters);

    // 3. Parse each segment
    const parsedSegments = segmentStrings.map((str, index) => {
        const parsed = _parseSegment(str, delimiters);
        return { ...parsed, position: index + 1 };
    });

    const parseTime = Date.now();

    // 4. Find key segments
    const unbSegment = parsedSegments.find(s => s.tag === 'UNB');
    const unhSegment = parsedSegments.find(s => s.tag === 'UNH');

    // 5. Extract structured data
    const interchange = _extractInterchange(unbSegment);
    const messageHeader = _extractMessageHeader(unhSegment);
    const businessData = _extractBusinessData(parsedSegments);
    const parties = _extractParties(parsedSegments);

    // 6. Validate
    const validation = _validateStructure(parsedSegments, delimiters);
    const validationTime = Date.now();

    // 7. Build compliance
    const compliance = _buildCompliance(parsedSegments, messageHeader, userContext);

    // 8. Build segment details
    const segmentDetails = parsedSegments.map(seg => ({
        tag: seg.tag,
        position: seg.position,
        content: seg.raw,
        fields: seg.fields.map(f => f.value),
        hasErrors: validation.details.some(d => d.segment === seg.tag && d.severity === 'error'),
        errorDetails: validation.details
            .filter(d => d.segment === seg.tag)
            .map(d => d.error || d.warning || '')
            .filter(Boolean)
    }));

    // 9. Build preview (first 4000 chars of raw content)
    const rawPreview = rawContent.slice(0, 4000);

    // 10. Processing metadata
    const totalTime = Date.now();
    const processing = {
        parsingDuration: parseTime - startTime,
        validationDuration: validationTime - parseTime,
        totalDuration: totalTime - startTime,
        fileSize: fileInfo.size || Buffer.byteLength(rawContent, 'utf8'),
        lineCount: rawContent.split('\n').length,
        truncated: parsedSegments.length > 5000,
        truncatedAt: parsedSegments.length > 5000 ? 5000 : null,
        rawPreview
    };

    // 11. Build analysis (without LLM context yet - needs the analysis first)
    const analysis = {
        interchange,
        messageHeader,
        segments: [...new Set(parsedSegments.map(s => s.tag))],
        segmentCount: parsedSegments.length,
        segmentDetails: segmentDetails.slice(0, 5000), // Limit for DB storage
        validation,
        businessData,
        parties,
        compliance,
        processing,
        status: validation.errorCount > 0 ? 'parsed' : 'validated'
    };

    // 12. Build LLM context + summary (needs full analysis)
    analysis.llmContext = _buildLLMContext(analysis);
    analysis.summary = _buildSummary(analysis);

    // 13. Token estimates
    analysis.processing.tokenCount = _estimateTokens(analysis.llmContext);
    analysis.processing.compressionRatio = rawContent.length > 0
        ? (analysis.llmContext.length / rawContent.length)
        : 0;

    return analysis;
}

/**
 * Build analysis from pre-parsed segments (for worker compatibility)
 * If the worker already parsed segments, use this to avoid re-reading the file
 */
export function buildAnalysisFromSegments(segments, rawContent, fileInfo, userContext = {}) {
    return buildAnalysis(rawContent, fileInfo, userContext);
}
