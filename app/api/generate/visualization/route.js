import { NextResponse } from 'next/server';
import { Worker } from 'worker_threads';
import { randomUUID } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In-memory job storage (in production, use Redis or DB)
const jobs = new Map();

// Temp upload directory
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

function detectMessageType(edifactText) {
  if (!edifactText) return null;
  // Try to detect via UNH segment: UNH+...:ORDERS:D:96A:...
  const unhMatch = edifactText.match(/UNH[^\n\r]*:(?<type>[A-Z0-9]+):/i);
  if (unhMatch && unhMatch.groups?.type) {
    return unhMatch.groups.type.toUpperCase();
  }
  // Fallback: look for BGM doc type (not reliable for message type)
  const bgmMatch = edifactText.match(/BGM\+(?<docType>[0-9]{3})/i);
  if (bgmMatch && bgmMatch.groups?.docType) {
    return `BGM-${bgmMatch.groups.docType}`;
  }
  return null;
}

function getSubsetLabel(subset) {
  if (!subset) return null;
  const MAP = {
    'ansi-asc-x12': 'ANSI ASC X12',
    'eancom': 'EANCOM',
    'hipaa': 'HIPAA',
    'odette': 'ODETTE Automotive',
    'oracle-gateway': 'Oracle-Gateway',
    'rosettanet': 'RosettaNet',
    'sap': 'SAP',
    'swift': 'SWIFT',
    'tradacoms': 'TRADACOMS',
    'un-edifact': 'UN/EDIFACT',
    'vda': 'VDA',
    'vics': 'VICS',
  };
  return MAP[subset] ?? subset;
}

export async function POST(req) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ ok: false, error: 'Content-Type must be multipart/form-data' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    const subset = formData.get('subset') || null;

    if (!file || typeof file === 'string') {
      return NextResponse.json({ ok: false, error: 'Missing file field' }, { status: 400 });
    }

    // Basic validation on filename/size
    const name = file.name || 'upload.edi';
    const size = file.size ?? 0;
    const allowedExt = ['.edi', '.edifact', '.txt'];
    const hasAllowedExt = allowedExt.some((ext) => name.toLowerCase().endsWith(ext));
    if (!hasAllowedExt) {
      return NextResponse.json({ ok: false, error: 'Unsupported file type. Allowed: .edi, .edifact, .txt' }, { status: 400 });
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Save file to disk (for streaming, avoids loading entire file into RAM)
    const jobId = randomUUID();
    const filePath = path.join(UPLOAD_DIR, `${jobId}.edi`);
    const arrayBuffer = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(arrayBuffer));

    console.log(`[API] File saved to: ${filePath} (${size} bytes)`);
    
    // Create and start Worker Thread
    const workerPath = path.resolve(process.cwd(), '_workers/edifactParser.worker.js');
    const worker = new Worker(workerPath);

    // Store job metadata
    jobs.set(jobId, {
      jobId,
      status: 'processing',
      worker,
      filePath,
      startedAt: new Date(),
    });

    // Listen for Worker messages
    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        // Broadcast progress via Socket.IO
        if (global.io) {
          global.io.to(`job:${jobId}`).emit('progress', {
            jobId: msg.jobId,
            percent: msg.percent,
            message: msg.message,
          });
        }
      } else if (msg.type === 'complete') {
        // Update job status and broadcast completion
        const job = jobs.get(jobId);
        if (job) {
          job.status = 'complete';
          job.result = msg.result;
          job.completedAt = new Date();
        }
        
        if (global.io) {
          global.io.to(`job:${jobId}`).emit('complete', {
            jobId: msg.jobId,
            result: msg.result,
          });
        }
        
        // Clean up worker
        worker.terminate();
      } else if (msg.type === 'error') {
        // Update job status and broadcast error
        const job = jobs.get(jobId);
        if (job) {
          job.status = 'error';
          job.error = msg.error;
        }
        
        if (global.io) {
          global.io.to(`job:${jobId}`).emit('error', {
            jobId: msg.jobId,
            error: msg.error,
          });
        }
        
        // Clean up worker
        worker.terminate();
      }
    });

    worker.on('error', (error) => {
      console.error(`[Worker ${jobId}] Error:`, error);
      const job = jobs.get(jobId);
      if (job) {
        job.status = 'error';
        job.error = error.message;
      }
      
      if (global.io) {
        global.io.to(`job:${jobId}`).emit('error', {
          jobId,
          error: error.message,
        });
      }
    });

    // Start the worker with job data (filePath for streaming)
    worker.postMessage({ jobId, filePath, subset, fileName: name });

    // Return immediately with jobId
    return NextResponse.json({
      ok: true,
      jobId,
      file: { name, size },
      message: 'Processing started. Subscribe to job updates via WebSocket.',
    }, { status: 202 }); // 202 Accepted

  } catch (err) {
    console.error('Visualization upload error:', err);
    return NextResponse.json({ ok: false, error: 'Unexpected error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Visualization upload endpoint' });
}
