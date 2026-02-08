/**
 * X12 Analysis Builder
 * ====================
 * Deterministic builder that converts parsed X12 (ANSI ASC X12) segments
 * into a rich analysis object compatible with EdifactAnalysis schema.
 *
 * Supports ISA/GS/ST envelope parsing, control number validation,
 * segment counting, and basic structural validation.
 *
 * Pure function - no side effects, no DB access, no LLM calls.
 *
 * X12 Structure:
 *   ISA (Interchange Header)
 *     GS (Functional Group Header)
 *       ST (Transaction Set Header)
 *         ... data segments ...
 *       SE (Transaction Set Trailer)
 *     GE (Functional Group Trailer)
 *   IEA (Interchange Trailer)
 *
 * Delimiters (defined by ISA segment):
 *   - Element separator: ISA[3] (typically *)
 *   - Sub-element (component) separator: ISA16 (typically : or >)
 *   - Segment terminator: character after ISA16 (typically ~)
 */

// ==================== X12 DELIMITER DETECTION ====================

/**
 * Parse X12 delimiters from ISA segment or infer from content.
 * When ISA is present: use fixed-length ISA positions (106 chars).
 * When ISA is absent (bare ST/GS): infer delimiters from content patterns.
 * @param {string} rawContent - Raw X12 content
 * @returns {object} { element: '*', component: ':', segment: '~' }
 * @private
 */
function _parseX12Delimiters(rawContent) {
    const trimmed = rawContent.trim();

    // Full ISA envelope: use fixed character positions
    if (/^ISA[^A-Za-z0-9\s]/.test(trimmed) && trimmed.length >= 106) {
        const elementSep = trimmed.charAt(3);
        const componentSep = trimmed.charAt(104);
        const segmentTerm = trimmed.charAt(105);
        return {
            element: elementSep || '*',
            component: componentSep || ':',
            segment: segmentTerm || '~'
        };
    }

    // No ISA (bare ST/GS): infer delimiters from content
    const sepMatch = trimmed.match(/^[A-Z][A-Z0-9]{1,2}([^A-Za-z0-9\s\r\n])/);
    const elementSep = sepMatch?.[1] || '*';
    const segmentTerm = trimmed.includes('~') ? '~' : '\n';
    const componentSep = trimmed.includes('>') ? '>' : ':';

    return {
        element: elementSep,
        component: componentSep,
        segment: segmentTerm
    };
}

// ==================== X12 SEGMENT PARSING ====================

/**
 * Split raw X12 content into segment strings.
 * @param {string} rawContent - Raw X12 content
 * @param {string} segmentTerminator - Segment terminator character
 * @returns {string[]} Array of segment strings (trimmed, non-empty)
 * @private
 */
function _splitX12Segments(rawContent, segmentTerminator) {
    return rawContent
        .split(segmentTerminator)
        .map(s => s.trim().replace(/^[\r\n]+|[\r\n]+$/g, ''))
        .filter(s => s.length > 0);
}

/**
 * Parse a single X12 segment into tag and elements.
 * @param {string} segmentStr - Raw segment string
 * @param {string} elementSep - Element separator
 * @param {string} componentSep - Component separator
 * @returns {object} { tag, elements: [{ value, components }], raw }
 * @private
 */
function _parseX12Segment(segmentStr, elementSep, componentSep) {
    const parts = segmentStr.split(elementSep);
    const tag = parts[0] || '';
    const elements = parts.slice(1).map(val => ({
        value: val,
        components: val.includes(componentSep) ? val.split(componentSep) : [val]
    }));

    return { tag, elements, raw: segmentStr };
}

// ==================== X12 DATE PARSING ====================

/**
 * Parse an X12 date value according to its format qualifier.
 * Returns a valid Date object or null.
 *
 * Supported X12 Date/Time Period Format Qualifiers:
 *   D8 — CCYYMMDD (8 chars)
 *   D6 — YYMMDD (6 chars)
 *   DT — CCYYMMDDHHMMSS or CCYYMMDDHHMM (12-14 chars)
 *   TM — HHMM or HHMMSS (4-6 chars) — time only, returns null
 *   RD8 — CCYYMMDD-CCYYMMDD (date range, uses start date)
 *
 * @param {string} value - Raw date string from DTP element
 * @param {string} format - Format qualifier (D8, D6, DT, RD8, TM, etc.)
 * @returns {Date|null} Parsed Date or null if unparseable
 * @private
 */
function _parseX12Date(value, format) {
    if (!value) return null;

    switch (format) {
        case 'D8': {
            // CCYYMMDD → Date
            if (value.length !== 8) return null;
            const d = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`);
            return (!isNaN(d.getTime())) ? d : null;
        }
        case 'D6': {
            // YYMMDD → Date (assumes 20xx century)
            if (value.length !== 6) return null;
            const year = parseInt(value.slice(0, 2), 10);
            const century = year > 50 ? '19' : '20';
            const d = new Date(`${century}${value.slice(0, 2)}-${value.slice(2, 4)}-${value.slice(4, 6)}T00:00:00Z`);
            return (!isNaN(d.getTime())) ? d : null;
        }
        case 'DT': {
            // CCYYMMDDHHMM or CCYYMMDDHHMMSS → Date
            if (value.length < 12) return null;
            const hours = value.slice(8, 10);
            const mins = value.slice(10, 12);
            const secs = value.length >= 14 ? value.slice(12, 14) : '00';
            const d = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${hours}:${mins}:${secs}Z`);
            return (!isNaN(d.getTime())) ? d : null;
        }
        case 'RD8': {
            // CCYYMMDD-CCYYMMDD (date range) → use start date
            const dashIdx = value.indexOf('-');
            if (dashIdx === -1 || dashIdx < 8) return null;
            const startDate = value.slice(0, 8);
            const d = new Date(`${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}T00:00:00Z`);
            return (!isNaN(d.getTime())) ? d : null;
        }
        case 'TM': {
            // HHMM or HHMMSS — time-only, cannot create meaningful Date
            return null;
        }
        default: {
            // Fallback: try D8-style parse if value is 8 digits
            if (/^\d{8}$/.test(value)) {
                const d = new Date(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`);
                return (!isNaN(d.getTime())) ? d : null;
            }
            return null;
        }
    }
}

// ==================== DATA EXTRACTORS ====================

/**
 * Extract interchange data from ISA segment.
 * ISA has 16 fixed elements (all fixed-length in standard X12).
 * @private
 */
function _extractX12Interchange(isaSegment, ieaSegment) {
    if (!isaSegment) return null;
    const e = isaSegment.elements;

    // ISA elements (0-indexed after tag):
    // 0: Auth Info Qualifier, 1: Auth Info
    // 2: Security Info Qualifier, 3: Security Info
    // 4: Interchange ID Qualifier (sender), 5: Interchange Sender ID
    // 6: Interchange ID Qualifier (receiver), 7: Interchange Receiver ID
    // 8: Interchange Date (YYMMDD), 9: Interchange Time (HHMM)
    // 10: Repetition Separator, 11: Interchange Control Version
    // 12: Interchange Control Number, 13: Ack Requested
    // 14: Usage Indicator (P=Production, T=Test)
    // 15: Component Element Separator

    let dateTime = null;
    const dateStr = e[8]?.value || '';
    const timeStr = e[9]?.value || '';
    if (dateStr.length >= 6) {
        try {
            const year = '20' + dateStr.slice(0, 2);
            const month = dateStr.slice(2, 4);
            const day = dateStr.slice(4, 6);
            const hour = timeStr.slice(0, 2) || '00';
            const minute = timeStr.slice(2, 4) || '00';
            dateTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:00Z`);
            if (isNaN(dateTime.getTime())) dateTime = null;
        } catch {
            dateTime = null;
        }
    }

    return {
        sender: (e[5]?.value || '').trim(),
        receiver: (e[7]?.value || '').trim(),
        controlReference: (e[12]?.value || '').trim(),
        syntaxIdentifier: 'X12',
        syntaxVersion: (e[11]?.value || '').trim(),
        testIndicator: (e[14]?.value || '').trim() === 'T',
        dateTime,
        recipientRef: '',
        applicationRef: ''
    };
}

/**
 * Extract functional group info from GS segment.
 * @private
 */
function _extractX12FunctionalGroup(gsSegment) {
    if (!gsSegment) return null;
    const e = gsSegment.elements;

    // GS elements:
    // 0: Functional Identifier Code (e.g., HP, HB, FA, etc.)
    // 1: Application Sender's Code
    // 2: Application Receiver's Code
    // 3: Date (CCYYMMDD)
    // 4: Time (HHMM)
    // 5: Group Control Number
    // 6: Responsible Agency Code (X = X12)
    // 7: Version / Release / Industry Code

    return {
        functionalId: e[0]?.value || '',
        senderCode: e[1]?.value || '',
        receiverCode: e[2]?.value || '',
        date: e[3]?.value || '',
        time: e[4]?.value || '',
        controlNumber: e[5]?.value || '',
        agencyCode: e[6]?.value || '',
        versionCode: e[7]?.value || ''
    };
}

/**
 * Extract message header from ST segment.
 * Maps to EdifactAnalysis.messageHeader format.
 * @private
 */
function _extractX12MessageHeader(stSegment, gsInfo) {
    if (!stSegment) return null;
    const e = stSegment.elements;

    // ST elements:
    // 0: Transaction Set Identifier Code (e.g., 271, 835, 837)
    // 1: Transaction Set Control Number
    // 2: Implementation Convention Reference (e.g., 005010X279A1)

    const txSetId = e[0]?.value || '';
    const controlNumber = e[1]?.value || '';
    const implRef = e[2]?.value || '';

    return {
        messageReference: controlNumber,
        messageType: txSetId,
        messageVersion: gsInfo?.versionCode || implRef || '',
        messageRelease: implRef || '',
        controllingAgency: 'X12',
        associationCode: gsInfo?.functionalId || ''
    };
}

/**
 * Map X12 Transaction Set ID to human-readable type.
 * @private
 */
function _getX12TransactionType(txSetId) {
    const types = {
        '270': 'Eligibility, Coverage or Benefit Inquiry',
        '271': 'Eligibility, Coverage or Benefit Information',
        '274': 'Healthcare Provider Information',
        '275': 'Patient Information',
        '276': 'Health Care Claim Status Request',
        '277': 'Health Care Claim Status Notification',
        '278': 'Health Care Services Review',
        '810': 'Invoice',
        '820': 'Payment Order/Remittance Advice',
        '824': 'Application Advice',
        '830': 'Planning Schedule with Release Capability',
        '832': 'Price/Sales Catalog',
        '834': 'Benefit Enrollment and Maintenance',
        '835': 'Health Care Claim Payment/Advice',
        '837': 'Health Care Claim',
        '840': 'Request for Quotation',
        '843': 'Response to Request for Quotation',
        '844': 'Product Transfer Account Adjustment',
        '846': 'Inventory Inquiry/Advice',
        '850': 'Purchase Order',
        '855': 'Purchase Order Acknowledgment',
        '856': 'Ship Notice/Manifest',
        '860': 'Purchase Order Change Request',
        '861': 'Receiving Advice/Acceptance Certificate',
        '864': 'Text Message',
        '940': 'Warehouse Shipping Order',
        '945': 'Warehouse Shipping Advice',
        '997': 'Functional Acknowledgment',
        '999': 'Implementation Acknowledgment'
    };
    return types[txSetId] || `Transaction Set ${txSetId}`;
}

/**
 * Extract parties from NM1 segments.
 * NM1 = Entity Name in X12.
 * @private
 */
function _extractX12Parties(parsedSegments) {
    const parties = [];

    for (const seg of parsedSegments) {
        if (seg.tag !== 'NM1') continue;
        const e = seg.elements;

        // NM1 elements:
        // 0: Entity Identifier Code (e.g., PR=Payer, 1P=Provider, IL=Insured)
        // 1: Entity Type Qualifier (1=Person, 2=Non-Person)
        // 2: Name Last or Organization Name
        // 3: Name First
        // 4: Name Middle
        // 5: Name Prefix
        // 6: Name Suffix
        // 7: Identification Code Qualifier
        // 8: Identification Code

        const qualifier = e[0]?.value || '';
        const entityType = e[1]?.value || '';
        const lastName = e[2]?.value || '';
        const firstName = e[3]?.value || '';

        const name = entityType === '1'
            ? [firstName, lastName].filter(Boolean).join(' ')
            : lastName;

        parties.push({
            qualifier,
            id: e[8]?.value || '',
            idType: e[7]?.value || '',
            name,
            address: { street: [], city: '', postalCode: '', countryCode: '', region: '' },
            contact: { name: '', phone: '', email: '', fax: '' }
        });
    }

    return parties;
}

/**
 * Extract basic business data from X12 segments.
 * @private
 */
function _extractX12BusinessData(parsedSegments, txSetId) {
    const business = {
        documentNumber: '',
        documentType: _getX12TransactionType(txSetId),
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
            case 'BHT': {
                // BHT: Beginning of Hierarchical Transaction
                // 0: Hierarchical Structure Code
                // 1: Transaction Set Purpose Code
                // 2: Reference Identification (originator app transaction ID)
                // 3: Date (CCYYMMDD)
                // 4: Time (HHMM)
                business.documentNumber = seg.elements[2]?.value || '';
                const dateVal = seg.elements[3]?.value || '';
                if (dateVal.length === 8) {
                    try {
                        const d = new Date(`${dateVal.slice(0, 4)}-${dateVal.slice(4, 6)}-${dateVal.slice(6, 8)}`);
                        if (!isNaN(d.getTime())) {
                            business.documentDate = d;
                            business.dates.push({ qualifier: 'BHT', date: d, format: 'CCYYMMDD' });
                        }
                    } catch { /* ignore */ }
                }
                break;
            }
            case 'DTP': {
                // DTP: Date/Time Period
                // 0: Date/Time Qualifier
                // 1: Date/Time Period Format Qualifier (D8, D6, DT, RD8, TM, etc.)
                // 2: Date/Time Period
                const qualifier = seg.elements[0]?.value || '';
                const format = seg.elements[1]?.value || '';
                const value = seg.elements[2]?.value || '';
                const parsedDate = _parseX12Date(value, format);
                if (parsedDate) {
                    business.dates.push({ qualifier, date: parsedDate, format });
                }
                break;
            }
            case 'REF': {
                // REF: Reference Information
                const qualifier = seg.elements[0]?.value || '';
                const value = seg.elements[1]?.value || '';
                business.references.push({ qualifier, value });
                break;
            }
            case 'CLM': {
                // CLM: Claim Information (837)
                business.lineItemCount++;
                const amount = parseFloat(seg.elements[1]?.value);
                if (!isNaN(amount)) business.totalAmount = (business.totalAmount || 0) + amount;
                break;
            }
            case 'CLP': {
                // CLP: Claim Level Data (835)
                business.lineItemCount++;
                break;
            }
        }
    }

    return business;
}

// ==================== VALIDATION ====================

/**
 * Validate X12 structure: envelope matching, control numbers, segment counts.
 * @private
 */
function _validateX12Structure(parsedSegments) {
    const details = [];
    let errorCount = 0;
    let warningCount = 0;

    const tags = parsedSegments.map(s => s.tag);

    // Required envelope segments
    const hasISA = tags.includes('ISA');
    const hasIEA = tags.includes('IEA');
    const hasGS = tags.includes('GS');
    const hasGE = tags.includes('GE');
    const hasST = tags.includes('ST');
    const hasSE = tags.includes('SE');

    if (!hasISA) {
        details.push({ segment: 'ISA', code: 'MISSING_ISA', error: 'Missing interchange header (ISA)', severity: 'error', suggestion: 'Add ISA segment at the beginning' });
        errorCount++;
    }
    if (!hasIEA) {
        details.push({ segment: 'IEA', code: 'MISSING_IEA', error: 'Missing interchange trailer (IEA)', severity: 'error', suggestion: 'Add IEA segment at the end' });
        errorCount++;
    }
    if (!hasGS) {
        details.push({ segment: 'GS', code: 'MISSING_GS', error: 'Missing functional group header (GS)', severity: 'error', suggestion: 'Add GS segment after ISA' });
        errorCount++;
    }
    if (!hasGE) {
        details.push({ segment: 'GE', code: 'MISSING_GE', error: 'Missing functional group trailer (GE)', severity: 'error', suggestion: 'Add GE segment before IEA' });
        errorCount++;
    }
    if (!hasST) {
        details.push({ segment: 'ST', code: 'MISSING_ST', error: 'Missing transaction set header (ST)', severity: 'error', suggestion: 'Add ST segment after GS' });
        errorCount++;
    }
    if (!hasSE) {
        details.push({ segment: 'SE', code: 'MISSING_SE', error: 'Missing transaction set trailer (SE)', severity: 'error', suggestion: 'Add SE segment before GE' });
        errorCount++;
    }

    // SE segment count validation
    const seSegment = parsedSegments.find(s => s.tag === 'SE');
    const stSegment = parsedSegments.find(s => s.tag === 'ST');
    if (seSegment && stSegment) {
        const declaredCount = parseInt(seSegment.elements[0]?.value, 10);
        const stIndex = tags.indexOf('ST');
        const seIndex = tags.indexOf('SE');
        if (stIndex >= 0 && seIndex > stIndex) {
            const actualCount = seIndex - stIndex + 1;
            if (declaredCount && declaredCount !== actualCount) {
                details.push({
                    segment: 'SE', code: 'SEGMENT_COUNT_MISMATCH',
                    error: `SE declares ${declaredCount} segments but found ${actualCount} (ST to SE inclusive)`,
                    severity: 'error',
                    suggestion: `Update SE segment count to ${actualCount}`
                });
                errorCount++;
            }
        }

        // SE control number should match ST
        const seControlNum = (seSegment.elements[1]?.value || '').trim();
        const stControlNum = (stSegment.elements[1]?.value || '').trim();
        if (seControlNum && stControlNum && seControlNum !== stControlNum) {
            details.push({
                segment: 'SE', code: 'CONTROL_NUMBER_MISMATCH',
                error: `SE control number (${seControlNum}) does not match ST (${stControlNum})`,
                severity: 'error',
                suggestion: `Update SE control number to match ST: ${stControlNum}`
            });
            errorCount++;
        }
    }

    // GE group count validation
    const geSegment = parsedSegments.find(s => s.tag === 'GE');
    const gsSegment = parsedSegments.find(s => s.tag === 'GS');
    if (geSegment) {
        const declaredTxSets = parseInt(geSegment.elements[0]?.value, 10);
        const stCount = tags.filter(t => t === 'ST').length;
        if (declaredTxSets && declaredTxSets !== stCount) {
            details.push({
                segment: 'GE', code: 'TX_SET_COUNT_MISMATCH',
                error: `GE declares ${declaredTxSets} transaction sets but found ${stCount}`,
                severity: 'error',
                suggestion: `Update GE count to ${stCount}`
            });
            errorCount++;
        }

        // GE control number should match GS
        if (gsSegment) {
            const geControlNum = (geSegment.elements[1]?.value || '').trim();
            const gsControlNum = (gsSegment.elements[5]?.value || '').trim();
            if (geControlNum && gsControlNum && geControlNum !== gsControlNum) {
                details.push({
                    segment: 'GE', code: 'GS_GE_CONTROL_MISMATCH',
                    error: `GE control number (${geControlNum}) does not match GS (${gsControlNum})`,
                    severity: 'error',
                    suggestion: `Update GE control number to match GS: ${gsControlNum}`
                });
                errorCount++;
            }
        }
    }

    // IEA group count validation
    const ieaSegment = parsedSegments.find(s => s.tag === 'IEA');
    const isaSegment = parsedSegments.find(s => s.tag === 'ISA');
    if (ieaSegment) {
        const declaredGroups = parseInt(ieaSegment.elements[0]?.value, 10);
        const gsCount = tags.filter(t => t === 'GS').length;
        if (declaredGroups && declaredGroups !== gsCount) {
            details.push({
                segment: 'IEA', code: 'GROUP_COUNT_MISMATCH',
                error: `IEA declares ${declaredGroups} functional groups but found ${gsCount}`,
                severity: 'error',
                suggestion: `Update IEA count to ${gsCount}`
            });
            errorCount++;
        }

        // IEA control number should match ISA
        if (isaSegment) {
            const ieaControlNum = (ieaSegment.elements[1]?.value || '').trim();
            const isaControlNum = (isaSegment.elements[12]?.value || '').trim();
            if (ieaControlNum && isaControlNum && ieaControlNum !== isaControlNum) {
                details.push({
                    segment: 'IEA', code: 'ISA_IEA_CONTROL_MISMATCH',
                    error: `IEA control number (${ieaControlNum}) does not match ISA (${isaControlNum})`,
                    severity: 'error',
                    suggestion: `Update IEA control number to match ISA: ${isaControlNum}`
                });
                errorCount++;
            }
        }
    }

    return { errorCount, warningCount, details };
}

// ==================== COMPLIANCE ====================

/**
 * Build compliance info for X12.
 * @private
 */
function _buildX12Compliance(parsedSegments, messageHeader, gsInfo) {
    const tags = parsedSegments.map(s => s.tag);

    const requiredSegments = ['ISA', 'GS', 'ST', 'SE', 'GE', 'IEA'];
    const missingSegments = requiredSegments.filter(tag => !tags.includes(tag));

    return {
        standard: 'ANSI X12',
        subset: gsInfo?.functionalId || '',
        version: messageHeader?.messageVersion || gsInfo?.versionCode || '',
        isCompliant: missingSegments.length === 0,
        requiredSegments,
        missingSegments,
        unexpectedSegments: [],
        mandatoryFieldsMissing: []
    };
}

// ==================== CONTEXT BUILDER ====================

/**
 * Build LLM-optimized context string for X12.
 * @private
 */
function _buildX12LLMContext(analysis) {
    const lines = [];

    const txType = _getX12TransactionType(analysis.messageHeader?.messageType);
    lines.push(`## X12 Analysis`);
    lines.push(`Type: ${analysis.messageHeader?.messageType || 'Unknown'} - ${txType} (${analysis.compliance?.standard || 'ANSI X12'} ${analysis.compliance?.version || ''})`);
    lines.push(`Segments: ${analysis.segmentCount}`);

    if (analysis.interchange) {
        lines.push(`Sender: ${analysis.interchange.sender} | Receiver: ${analysis.interchange.receiver}`);
        if (analysis.interchange.testIndicator) lines.push(`Mode: TEST`);
    }

    if (analysis.businessData) {
        const bd = analysis.businessData;
        if (bd.documentNumber) lines.push(`Document: ${bd.documentType} #${bd.documentNumber}`);
        if (bd.totalAmount !== null) lines.push(`Total: ${bd.totalAmount}`);
        if (bd.lineItemCount > 0) lines.push(`Claims/Items: ${bd.lineItemCount}`);
    }

    if (analysis.parties?.length > 0) {
        lines.push(`\nParties:`);
        for (const p of analysis.parties) {
            const label = _x12EntityLabel(p.qualifier);
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

    // Segment distribution
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
 * Map X12 NM1 entity identifier codes to labels.
 * @private
 */
function _x12EntityLabel(code) {
    const labels = {
        'PR': 'Payer',
        '1P': 'Provider',
        'IL': 'Insured/Subscriber',
        'QC': 'Patient',
        '40': 'Receiver',
        '41': 'Submitter',
        '45': 'Drop-off Location',
        '71': 'Attending Physician',
        '72': 'Operating Physician',
        '73': 'Other Physician',
        '77': 'Service Location',
        '82': 'Rendering Provider',
        '85': 'Billing Provider',
        '87': 'Pay-to Provider',
        'DN': 'Referring Provider',
        'DQ': 'Supervising Physician',
        'FA': 'Facility',
        'LI': 'Independent Lab',
        'PE': 'Payee',
        'PW': 'Pickup Address',
        'SU': 'Supplier',
        'BY': 'Buyer',
        'SE': 'Seller'
    };
    return labels[code] || `Entity (${code})`;
}

/**
 * Build human-readable summary for X12.
 * @private
 */
function _buildX12Summary(analysis) {
    const parts = [];
    const txSetId = analysis.messageHeader?.messageType || 'Unknown';
    const txType = _getX12TransactionType(txSetId);

    parts.push(`ANSI X12 ${txSetId} (${txType})`);

    if (analysis.compliance?.version) {
        parts.push(`version ${analysis.compliance.version}`);
    }

    parts.push(`with ${analysis.segmentCount} segments`);

    if (analysis.businessData?.documentNumber) {
        parts.push(`- Document #${analysis.businessData.documentNumber}`);
    }

    if (analysis.interchange?.sender) {
        parts.push(`from ${analysis.interchange.sender}`);
    }
    if (analysis.interchange?.receiver) {
        parts.push(`to ${analysis.interchange.receiver}`);
    }

    if (analysis.validation?.errorCount > 0) {
        parts.push(`| ${analysis.validation.errorCount} validation errors found`);
    }

    return parts.join(' ');
}

// ==================== HELPERS ====================

/**
 * Estimate token count.
 * @param {string} text
 * @returns {number}
 * @private
 */
function _estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}

// ==================== MAIN BUILDER ====================

/**
 * Build complete _analysis object from raw X12 content.
 * Output is compatible with EdifactAnalysis schema.
 *
 * @param {string} rawContent - Raw X12 content (starting at ISA)
 * @param {object} fileInfo - { name, size, path }
 * @param {object} userContext - Optional user-provided context
 * @returns {object} Analysis matching EdifactAnalysis schema
 */
export function buildX12Analysis(rawContent, fileInfo, userContext = {}) {
    const startTime = Date.now();

    // 1. Parse delimiters from ISA
    const delimiters = _parseX12Delimiters(rawContent);

    // 2. Split into segments
    const segmentStrings = _splitX12Segments(rawContent, delimiters.segment);
    const parseTime = Date.now();

    // 3. Parse each segment
    const parsedSegments = segmentStrings.map((str, index) => {
        const parsed = _parseX12Segment(str, delimiters.element, delimiters.component);
        return { ...parsed, position: index + 1 };
    });

    // 4. Find key segments
    const isaSegment = parsedSegments.find(s => s.tag === 'ISA');
    const ieaSegment = parsedSegments.find(s => s.tag === 'IEA');
    const gsSegment = parsedSegments.find(s => s.tag === 'GS');
    const stSegment = parsedSegments.find(s => s.tag === 'ST');

    // 5. Extract structured data
    const interchange = _extractX12Interchange(isaSegment, ieaSegment);
    const gsInfo = _extractX12FunctionalGroup(gsSegment);
    const messageHeader = _extractX12MessageHeader(stSegment, gsInfo);
    const parties = _extractX12Parties(parsedSegments);
    const businessData = _extractX12BusinessData(parsedSegments, messageHeader?.messageType || '');

    // 6. Validate
    const validation = _validateX12Structure(parsedSegments);
    const validationTime = Date.now();

    // 7. Build compliance
    const compliance = _buildX12Compliance(parsedSegments, messageHeader, gsInfo);

    // 8. Build segment details (compatible with EdifactAnalysis schema)
    const segmentDetails = parsedSegments.map(seg => ({
        tag: seg.tag,
        position: seg.position,
        content: seg.raw,
        fields: seg.elements.map(e => e.value),
        hasErrors: validation.details.some(d => d.segment === seg.tag && d.severity === 'error'),
        errorDetails: validation.details
            .filter(d => d.segment === seg.tag)
            .map(d => d.error || d.warning || '')
            .filter(Boolean)
    }));

    // 9. Raw preview
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

    // 11. Build analysis
    const analysis = {
        interchange,
        messageHeader,
        segments: [...new Set(parsedSegments.map(s => s.tag))],
        segmentCount: parsedSegments.length,
        segmentDetails: segmentDetails.slice(0, 5000),
        validation,
        businessData,
        parties,
        compliance,
        processing,
        status: validation.errorCount > 0 ? 'parsed' : 'validated'
    };

    // 12. Build LLM context + summary
    analysis.llmContext = _buildX12LLMContext(analysis);
    analysis.summary = _buildX12Summary(analysis);

    // 13. Token estimates
    analysis.processing.tokenCount = _estimateTokens(analysis.llmContext);
    analysis.processing.compressionRatio = rawContent.length > 0
        ? (analysis.llmContext.length / rawContent.length)
        : 0;

    return analysis;
}
