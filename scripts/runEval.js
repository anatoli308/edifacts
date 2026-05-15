/**
 * CLI entry: npm run eval
 *
 * Usage:
 *   npm run eval                # run all cases, verbose summary, write report
 *   npm run eval -- --quiet     # only print summary table
 *
 * Exit codes:
 *   0  all cases passed
 *   1  at least one case failed or errored (CI gate)
 */

import 'dotenv/config';
import process from 'node:process';

import { runEval } from '../lib/ai/eval/harness.js';
import prisma from '../lib/db/prisma.js';

const args = process.argv.slice(2);
const verbose = !args.includes('--quiet');

async function main() {
    console.log('[eval] starting…');
    const report = await runEval({ verbose });

    const { summary, regressions, newPasses } = report;
    console.log('');
    console.log('═══ Summary ═════════════════════════════════════');
    console.log(`  total:     ${summary.total}`);
    console.log(`  passed:    ${summary.passed}`);
    console.log(`  failed:    ${summary.failed}`);
    console.log(`  errored:   ${summary.errored}`);
    console.log(`  pass rate: ${(summary.passRate * 100).toFixed(1)}%`);
    console.log(`  duration:  ${report.durationMs} ms`);
    console.log('');

    if (regressions.length) {
        console.log('⚠ Regressions vs previous run:');
        for (const r of regressions) {
            console.log(`  - ${r.id}`);
            for (const f of r.failures || []) console.log(`      ${f.rule}: ${f.msg}`);
            if (r.error) console.log(`      error: ${r.error}`);
        }
        console.log('');
    }

    if (newPasses.length) {
        console.log('✓ New passes vs previous run:');
        for (const p of newPasses) console.log(`  - ${p.id}`);
        console.log('');
    }

    console.log(`[eval] report written to lib/ai/eval/reports/latest.json`);

    const ok = summary.failed === 0 && summary.errored === 0;
    process.exitCode = ok ? 0 : 1;
}

main()
    .catch((err) => {
        console.error('[eval] fatal:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
