import { parentPort } from 'worker_threads';
import { createReadStream, statSync, existsSync } from 'fs';
import { unlink } from 'fs/promises';
import readline from 'readline';

parentPort.on('message', async ({ jobId, filePath, subset, fileName }) => {
  try {
    console.log(`[Worker ${jobId}] Starting EDIFACT parsing from: ${filePath}`);

    // Get file size for progress calculation
    const fileSize = statSync(filePath).size;
    let bytesRead = 0;
    // Create readline interface for streaming
    const rl = readline.createInterface({
      input: createReadStream(filePath),
      crlfDelay: Infinity,
    });

    let messageType = null;
    const segments = [];
    let lineNumber = 0;
    let lastProgressPercent = 0;
    // Stream line by line
    for await (const line of rl) {
      lineNumber++;
      bytesRead += Buffer.byteLength(line, 'utf8') + 1; // +1 for newline

      if (!line.trim()) continue;

      // Detect message type from UNH segment
      if (!messageType && line.startsWith('UNH')) {
        const match = line.match(/UNH[^:]*:([A-Z0-9]+):/i);
        if (match && match[1]) {
          messageType = match[1].toUpperCase();
        }
      }

      // Simple segment parsing (extract segment tag)
      const segmentMatch = line.match(/^([A-Z]{3})/);
      if (segmentMatch) {
        segments.push({
          tag: segmentMatch[1],
          content: line,
          line: lineNumber,
        });
      }

      // Send progress every 500 lines or when percent changes
      if (lineNumber % 500 === 0) {
        const percent = Math.min(Math.round((bytesRead / fileSize) * 100), 99);
        if (percent !== lastProgressPercent) {
          lastProgressPercent = percent;
          parentPort.postMessage({
            type: 'progress',
            jobId,
            percent,
            message: `Parsed ${lineNumber.toLocaleString()} lines, ${segments.length.toLocaleString()} segments`,
          });
        }
      }
    }

    // Build preview from first 50 segments
    const preview = segments.slice(0, 50).map(s => s.content).join('\n');

    // Build result - only return first 5000 segments to UI (prevents memory issues)
    const result = {
      file: { name: fileName || 'parsed.edi', size: fileSize },
      detected: { messageType: messageType || 'Unknown' },
      stats: {
        bytes: fileSize,
        lines: lineNumber,
        totalSegments: segments.length,
      },
      subset: subset ? { value: subset, label: subset.toUpperCase() } : null,
      views: {
        segments: { ready: true, count: segments.length },
      },
      preview: preview.slice(0, 4000),
      segments: segments.slice(0, 5000), // Limit to first 5000 for UI performance
      segmentsTruncated: segments.length > 5000,
    };

    console.log(`[Worker ${jobId}] Parsing complete: ${segments.length} segments from ${lineNumber} lines`);

    // Cleanup: Delete temp file
    /*try {
      await unlink(filePath);
      console.log(`[Worker ${jobId}] Cleaned up temp file: ${filePath}`);
    } catch (cleanupError) {
      console.warn(`[Worker ${jobId}] Failed to cleanup temp file:`, cleanupError.message);
    }*/

    parentPort.postMessage({
      type: 'complete',
      jobId,
      result,
    });
  } catch (error) {
    console.error(`[Worker ${jobId}] Error:`, error);
    parentPort.postMessage({
      type: 'error',
      jobId,
      error: error.message,
    });
  }
});
