/**
 * Eval scorers / assertion runners
 * =================================
 * Stateless helpers that compare an actual result object against an `expect`
 * spec defined in a case JSON file. Each scorer returns either null (pass) or
 * a string describing the failure.
 *
 * Supported assertions (all optional, AND-combined):
 *   success:        true|false             - require `actual.success` to match
 *   shape:          ["k1", "k2"]           - require these top-level keys present
 *   contains:       { "a.b": "value" }     - deep-equal at dotted path
 *   pathContains:   { "a.b": "substr" }    - substring match at dotted path
 *   minResults:     N                      - require `actual.results.length >= N`
 *   maxResults:     N                      - require `actual.results.length <= N`
 *   containsCode:   "131"                  - any result.code matches
 *   topResultCode:  "131"                  - results[0].code matches
 *   minSimilarityTop: 0.4                  - results[0].similarity >= threshold
 *   mode:           "exact"|"semantic"     - require `actual.mode` to match
 */

export function runAssertions(actual, expect) {
    if (!expect || typeof expect !== 'object') {
        return { passed: true, failures: [] };
    }

    const failures = [];
    const check = (label, msg) => {
        if (msg) failures.push({ rule: label, msg });
    };

    if (Object.prototype.hasOwnProperty.call(expect, 'success')) {
        check('success', _checkEquals('success', actual?.success, expect.success));
    }
    if (Array.isArray(expect.shape)) {
        check('shape', _checkShape(actual, expect.shape));
    }
    if (expect.contains && typeof expect.contains === 'object') {
        for (const [path, val] of Object.entries(expect.contains)) {
            check(`contains:${path}`, _checkEquals(path, _getPath(actual, path), val));
        }
    }
    if (expect.pathContains && typeof expect.pathContains === 'object') {
        for (const [path, substr] of Object.entries(expect.pathContains)) {
            check(`pathContains:${path}`, _checkSubstring(path, _getPath(actual, path), substr));
        }
    }
    if (typeof expect.minResults === 'number') {
        const len = Array.isArray(actual?.results) ? actual.results.length : 0;
        if (len < expect.minResults) {
            check('minResults', `expected >= ${expect.minResults} results, got ${len}`);
        }
    }
    if (typeof expect.maxResults === 'number') {
        const len = Array.isArray(actual?.results) ? actual.results.length : 0;
        if (len > expect.maxResults) {
            check('maxResults', `expected <= ${expect.maxResults} results, got ${len}`);
        }
    }
    if (expect.containsCode) {
        const codes = (actual?.results || []).map((r) => r?.code).filter(Boolean);
        if (!codes.includes(expect.containsCode)) {
            check('containsCode', `code "${expect.containsCode}" not in [${codes.join(', ')}]`);
        }
    }
    if (expect.topResultCode) {
        const top = actual?.results?.[0]?.code;
        if (top !== expect.topResultCode) {
            check('topResultCode', `expected top code "${expect.topResultCode}", got "${top}"`);
        }
    }
    if (typeof expect.minSimilarityTop === 'number') {
        const sim = actual?.results?.[0]?.similarity;
        if (typeof sim !== 'number' || sim < expect.minSimilarityTop) {
            check('minSimilarityTop', `top similarity ${sim} < ${expect.minSimilarityTop}`);
        }
    }
    if (expect.mode) {
        if (actual?.mode !== expect.mode) {
            check('mode', `expected mode "${expect.mode}", got "${actual?.mode}"`);
        }
    }

    return { passed: failures.length === 0, failures };
}

function _checkEquals(label, actualVal, expectedVal) {
    if (_deepEqual(actualVal, expectedVal)) return null;
    return `${label}: expected ${JSON.stringify(expectedVal)}, got ${JSON.stringify(actualVal)}`;
}

function _checkSubstring(label, actualVal, substr) {
    if (typeof actualVal !== 'string') {
        return `${label}: not a string (${typeof actualVal})`;
    }
    if (!actualVal.toLowerCase().includes(String(substr).toLowerCase())) {
        return `${label}: "${substr}" not found in "${actualVal.slice(0, 80)}"`;
    }
    return null;
}

function _checkShape(actual, requiredKeys) {
    if (!actual || typeof actual !== 'object') {
        return `actual is not an object`;
    }
    const missing = requiredKeys.filter((k) => !(k in actual));
    return missing.length ? `missing keys: ${missing.join(', ')}` : null;
}

function _getPath(obj, path) {
    if (obj == null) return undefined;
    return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function _deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a == null || b == null) return a === b;
    if (typeof a !== 'object') return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((k) => _deepEqual(a[k], b[k]));
}
