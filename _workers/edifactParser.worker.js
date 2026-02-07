import { readFileSync, statSync } from 'fs';
import { parentPort } from 'worker_threads';
import { buildAnalysis } from './edifactAnalysisBuilder.js';

parentPort.on('message', async ({ chat, file, user }) => {
  try {
    console.log(`[Worker ${chat._id}] Starting EDIFACT analysis from: '${file.path}' for user: ${user._id}`);

    const fileSize = statSync(file.path).size;

    // Progress: File reading
    parentPort.postMessage({
      type: 'progress',
      chatId: chat._id,
      percent: 10,
      message: `Reading file (${(fileSize / 1024).toFixed(1)} KB)...`,
    });

    // Read entire file (EDIFACT files are typically < 10MB)
    const rawContent = readFileSync(file.path, 'utf8');

    parentPort.postMessage({
      type: 'progress',
      chatId: chat._id,
      percent: 30,
      message: 'Parsing EDIFACT segments...',
    });

    // Build complete analysis using deterministic builder
    const userContext = {
      subset: chat.domainContext?.edifact?.subset || '',
      messageType: chat.domainContext?.edifact?.messageType || '',
      releaseVersion: chat.domainContext?.edifact?.releaseVersion || '',
      standardFamily: chat.domainContext?.edifact?.standardFamily || '',
    };

    const fileInfo = {
      name: file.originalName || 'upload.edi',
      size: fileSize,
      path: file.path,
    };

    const analysis = buildAnalysis(rawContent, fileInfo, userContext);

    parentPort.postMessage({
      type: 'progress',
      chatId: chat._id,
      percent: 80,
      message: `Validated ${analysis.segmentCount} segments (${analysis.validation.errorCount} errors, ${analysis.validation.warningCount} warnings)`,
    });

    console.log(`[Worker ${chat._id}] Analysis complete: ${analysis.segmentCount} segments, ${analysis.parties.length} parties, status: ${analysis.status}`);

    parentPort.postMessage({
      type: 'progress',
      chatId: chat._id,
      percent: 99,
      message: 'Building analysis result...',
    });

    // Send complete result with full analysis
    parentPort.postMessage({
      type: 'complete',
      chatId: chat._id,
      analysis, // Full EdifactAnalysis schema-compatible object
      result: {
        // Backward-compatible result for UI
        file: { name: fileInfo.name, size: fileSize },
        detected: { messageType: analysis.messageHeader?.messageType || 'Unknown' },
        stats: {
          bytes: fileSize,
          lines: analysis.processing.lineCount,
          totalSegments: analysis.segmentCount,
        },
        subset: chat.domainContext?.edifact?.subset,
        views: {
          segments: { ready: true, count: analysis.segmentCount },
        },
        preview: analysis.processing.rawPreview,
        segments: analysis.segmentDetails.slice(0, 5000).map(s => ({
          tag: s.tag,
          content: s.content,
          line: s.position,
        })),
        segmentsTruncated: analysis.processing.truncated,
      },
    });
  } catch (error) {
    console.error(`[Worker ${chat._id}] Error:`, error);
    parentPort.postMessage({
      type: 'error',
      chatId: chat._id,
      error: error.message,
    });
  }
});
