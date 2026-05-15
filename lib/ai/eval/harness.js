/**
 * Eval harness
 * ============
 * Loads test cases from lib/ai/eval/cases/*.json, runs each one, writes a
 * timestamped JSON report, and diffs the run against the previous `latest.json`
 * to surface regressions.
 *
 * Case shape (see cases/*.json for examples):
 *   {
 *     "id": "string (unique)",
 *     "type": "tool" | "rag",
 *     "description": "short human-readable",
 *     // for type=tool:
 *     "tool": "lookupEdifactCode",
 *     "args": { ... },
 *     // for type=rag:
 *     "query": "...", "code": "...", "source": "...", "category": "...", "topK": 5,
 *     "expect": { ...assertions, see scorers.js }
 *   }
 *
 * Report shape:
 *   {
 *     startedAt, finishedAt, durationMs,
 *     summary: { total, passed, failed, errored, passRate },
 *     regressions: [ { id, wasPassing, nowFailing, failures } ],
 *     newPasses:   [ { id } ],
 *     cases: [ { id, type, passed, errored, durationMs, failures, actual } ]
 *   }
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { tools as edifactTools } from '../../../_modules/edifact/tools/index.js';
import { hybridSearch } from '../rag/index.js';
import { Memory } from '../agents/memory.js';
import { runAssertions } from './scorers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CASES_DIR = path.join(__dirname, 'cases');
const REPORTS_DIR = path.join(__dirname, 'reports');

/**
 * Public entrypoint
 */
export async function runEval(options = {}) {
    const { verbose = false } = options;
    const startedAt = new Date();

    const cases = await _loadCases();
    if (verbose) console.log(`[eval] loaded ${cases.length} cases`);

    const previousReport = await _loadLatestReport();

    const results = [];
    for (const c of cases) {
        const result = await _runOne(c);
        results.push(result);
        if (verbose) {
            const tag = result.errored ? 'ERR ' : result.passed ? 'PASS' : 'FAIL';
            console.log(`  [${tag}] ${c.id} (${result.durationMs}ms)`);
            if (!result.passed && result.failures?.length) {
                for (const f of result.failures) {
                    console.log(`         - ${f.rule}: ${f.msg}`);
                }
            }
            if (result.errored) {
                console.log(`         ! ${result.error}`);
            }
        }
    }

    const finishedAt = new Date();
    const summary = _summarize(results);
    const diff = _diffAgainst(previousReport, results);

    const report = {
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt - startedAt,
        summary,
        regressions: diff.regressions,
        newPasses: diff.newPasses,
        cases: results,
    };

    await _writeReport(report);

    return report;
}

async function _loadCases() {
    const files = (await fs.readdir(CASES_DIR)).filter((f) => f.endsWith('.json'));
    const all = [];
    for (const file of files) {
        const text = await fs.readFile(path.join(CASES_DIR, file), 'utf8');
        const arr = JSON.parse(text);
        if (!Array.isArray(arr)) {
            throw new Error(`Case file ${file} must export an array`);
        }
        for (const c of arr) {
            if (!c.id || !c.type) {
                throw new Error(`Case in ${file} missing id/type: ${JSON.stringify(c).slice(0, 120)}`);
            }
            all.push({ ...c, _file: file });
        }
    }
    const ids = new Set();
    for (const c of all) {
        if (ids.has(c.id)) throw new Error(`Duplicate case id: ${c.id}`);
        ids.add(c.id);
    }
    return all;
}

async function _runOne(c) {
    const t0 = Date.now();
    try {
        const actual = await _dispatch(c);
        const { passed, failures } = runAssertions(actual, c.expect);
        return {
            id: c.id,
            type: c.type,
            description: c.description || null,
            file: c._file,
            durationMs: Date.now() - t0,
            passed,
            errored: false,
            failures,
            actual: _truncateForReport(actual),
        };
    } catch (err) {
        return {
            id: c.id,
            type: c.type,
            description: c.description || null,
            file: c._file,
            durationMs: Date.now() - t0,
            passed: false,
            errored: true,
            error: err?.message || String(err),
            failures: [],
            actual: null,
        };
    }
}

async function _dispatch(c) {
    if (c.type === 'tool') {
        const tool = edifactTools[c.tool];
        if (!tool) throw new Error(`Unknown tool: ${c.tool}`);
        if (typeof tool.execute !== 'function') {
            throw new Error(`Tool "${c.tool}" has no execute()`);
        }
        return await tool.execute(c.args || {});
    }

    if (c.type === 'rag') {
        return await hybridSearch({
            query: c.query,
            code: c.code,
            source: c.source,
            category: c.category,
            topK: c.topK ?? 5,
        });
    }

    if (c.type === 'memory') {
        return await _dispatchMemory(c);
    }

    throw new Error(`Unknown case type: ${c.type}`);
}

/**
 * Memory roundtrip dispatcher.
 * Each case carries `steps: [{op, args}]`. A single Memory instance is shared
 * across all steps to mirror real session behavior. Returns:
 *   { steps: [...resultsPerStep], final: lastResult }
 *
 * Assertions can target `final.success`, `final.longTerm.length`, etc.
 */
async function _dispatchMemory(c) {
    if (!Array.isArray(c.steps) || c.steps.length === 0) {
        throw new Error(`Memory case ${c.id} missing steps[]`);
    }
    const memory = new Memory();
    const stepResults = [];
    for (const step of c.steps) {
        const { op, args = {} } = step;
        if (typeof memory[op] !== 'function') {
            throw new Error(`Memory case ${c.id}: unknown op "${op}"`);
        }
        // Memory ops return either Promise<result> or sync. Normalize.
        const out = await memory[op](args);
        stepResults.push({ op, result: out });
    }
    return {
        steps: stepResults,
        final: stepResults[stepResults.length - 1].result,
    };
}

function _summarize(results) {
    const total = results.length;
    const errored = results.filter((r) => r.errored).length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed - errored;
    return {
        total,
        passed,
        failed,
        errored,
        passRate: total ? +(passed / total).toFixed(4) : 0,
    };
}

function _diffAgainst(previous, currentResults) {
    if (!previous?.cases) {
        return { regressions: [], newPasses: [] };
    }
    const prevById = new Map(previous.cases.map((c) => [c.id, c]));
    const regressions = [];
    const newPasses = [];
    for (const cur of currentResults) {
        const prev = prevById.get(cur.id);
        if (!prev) continue;
        if (prev.passed && !cur.passed) {
            regressions.push({
                id: cur.id,
                wasPassing: true,
                nowFailing: true,
                failures: cur.failures,
                error: cur.error || null,
            });
        } else if (!prev.passed && cur.passed) {
            newPasses.push({ id: cur.id });
        }
    }
    return { regressions, newPasses };
}

function _truncateForReport(actual) {
    // Avoid blowing up report size with huge RAG payloads — keep content but cap length
    if (!actual || typeof actual !== 'object') return actual;
    if (Array.isArray(actual.results)) {
        return {
            ...actual,
            results: actual.results.map((r) => ({
                ...r,
                content: typeof r?.content === 'string' && r.content.length > 400
                    ? r.content.slice(0, 400) + '…'
                    : r?.content,
            })),
        };
    }
    return actual;
}

async function _loadLatestReport() {
    try {
        const text = await fs.readFile(path.join(REPORTS_DIR, 'latest.json'), 'utf8');
        return JSON.parse(text);
    } catch {
        return null;
    }
}

async function _writeReport(report) {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
    const stamp = report.startedAt.replace(/[:.]/g, '-');
    const file = path.join(REPORTS_DIR, `eval-${stamp}.json`);
    await fs.writeFile(file, JSON.stringify(report, null, 2), 'utf8');
    await fs.writeFile(path.join(REPORTS_DIR, 'latest.json'), JSON.stringify(report, null, 2), 'utf8');
}
