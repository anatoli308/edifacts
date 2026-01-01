import Busboy from 'busboy';
import { randomUUID } from 'crypto';
import { createWriteStream, existsSync } from 'fs';
import { mkdir } from 'fs/promises';
import { NextResponse } from 'next/server';
import path from 'path';
import { Readable } from 'stream';
import { Worker } from 'worker_threads';

//app imports
import { getAuthenticatedUser } from '@/app/lib/auth';
import AnalysisChat from '@/app/models/AnalysisChat';
import User from '@/app/models/User';
import dbConnect from '@/app/lib/dbConnect';
import File from '@/app/models/File';

const jobs = new Map();
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Hilfsfunktion zur Konvertierung WebAPI Stream → Node.js-Stream
function webStreamToNodeStream(webStream) {
  const reader = webStream.getReader();
  return new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) {
        this.push(null);
      } else {
        this.push(Buffer.from(value));
      }
    }
  });
}

export async function POST(req) {
  return new Promise(async (resolve, reject) => {
    try {
      const contentType = req.headers.get('content-type') || '';

      if (!contentType.includes('multipart/form-data')) {
        resolve(NextResponse.json({ ok: false, error: 'Content-Type must be multipart/form-data' }, { status: 400 }));
        return;
      }

      if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true });

      const busboy = Busboy({ headers: Object.fromEntries(req.headers) });
      let size = 0;
      let subset = null;
      let backgroundMode = null;

      busboy.on('field', (field, val) => {
        if (field === 'subset') subset = val;
        if (field === 'backgroundMode') backgroundMode = val;
      });

      busboy.on('file', async (fieldname, file, fileInfo) => {
        try {
          // User-ID kommt von Middleware (bereits verifiziert)
          let authenticatedUser = await getAuthenticatedUser(req);
          console.log('[API] authenticated user:', authenticatedUser);
          if (!authenticatedUser) {
            authenticatedUser = await createGuestUser(backgroundMode);
          }

          const name = fileInfo.filename || 'upload.edi';
          const allowedExt = ['.edi', '.edifact', '.txt'];
          const hasAllowedExt = allowedExt.some(ext => name.toLowerCase().endsWith(ext));
          if (!hasAllowedExt) {
            file.on('end', () => {
              console.error('[API] Unsupported file type:', name);
              resolve(NextResponse.json({ ok: false, error: 'Unsupported file type.' }, { status: 400 }));
            });
            file.resume();
            return;
          }

          const newFile = new File({
            ownerId: authenticatedUser._id,
            chatId: null,
            originalName: name,
            mimeType: fileInfo.mimeType || 'application/octet-stream',
            size: 0, // wird später aktualisiert
            path: '', // wird später aktualisiert
            storage: 'local',
            status: 'ready',
          });

          const chat = new AnalysisChat({
            name: 'My EDIFACT Analysis',
            creatorId: authenticatedUser._id,
            model: 'gpt-4.1',
            apiKeyRef: null,
            personalizedPrompt: 'Bitte kurze, technische Zusammenfassungen',
            promptPreset: 'default',
            domainContext: { //TODO WIP
              edifact: {
                subset: 'INVOIC',
                fileId: newFile._id,
                version: 'D96A',
                options: {}
              }
            }
          });

          const jobId = chat._id.toString();
          const filePath = path.join(UPLOAD_DIR, `${jobId}.edi`);

          const ws = createWriteStream(filePath);
          file.on('data', chunk => { size += chunk.length; });
          file.pipe(ws);

          ws.on('close', () => {
            console.log(`[API] File saved to: ${filePath} (${size} bytes)`);

            const workerPath = path.resolve(process.cwd(), '_workers/edifactParser.worker.js');
            const worker = new Worker(workerPath);

            jobs.set(jobId, {
              jobId,
              status: 'processing',
              worker,
              filePath,
              startedAt: new Date(),
            });

            worker.on('message', (msg) => {
              console.log(`[API] Message from worker for job ${jobId}:`, msg);
              if (msg.type === 'progress' && global.io) {
                global.io.to(`job:${jobId}`).emit('progress', { jobId, percent: msg.percent, message: msg.message });
              }
              if (msg.type === 'complete') {
                const job = jobs.get(jobId);
                if (job) {
                  job.status = 'complete';
                  job.result = msg.result;
                  job.completedAt = new Date();
                }
                if (global.io) global.io.to(`job:${jobId}`).emit('complete', { jobId, result: msg.result });
                worker.terminate();
              }
              if (msg.type === 'error') {
                const job = jobs.get(jobId);
                if (job) {
                  job.status = 'error';
                  job.error = msg.error;
                }
                if (global.io) global.io.to(`job:${jobId}`).emit('error', { jobId, error: msg.error });
                worker.terminate();
              }
            });

            worker.on('error', (error) => {
              const job = jobs.get(jobId);
              if (job) {
                job.status = 'error';
                job.error = error.message;
              }
              if (global.io) global.io.to(`job:${jobId}`).emit('error', { jobId, error: error.message });
            });

            worker.postMessage({ chat: chat.toObject(), file: newFile.toObject(), user: authenticatedUser.toObject() });
            resolve(NextResponse.json({
              ok: true,
              jobId,
              file: { name, size },
              message: 'Processing started. Subscribe to job updates via WebSocket.',
              token: authenticatedUser.tokens[authenticatedUser.tokens.length - 1].token,
            }, { status: 202 }));
          });

          ws.on('error', (err) => {
            console.error('[API] File write error:', err);
            file.on('end', () => {
              console.error('[API] File write error (on end):', err.message);
              reject(NextResponse.json({ ok: false, error: err.message }, { status: 500 }));
            });
            file.resume();
          });
        } catch (err) {
          file.on('end', () => {
            console.error('[API] Unexpected error (catch):', err.message);
            reject(NextResponse.json({ ok: false, error: err.message }, { status: 500 }));
          });
          file.resume();
        }
      });

      busboy.on('error', error => {
        console.error('[API] Busboy error:', error);
        reject(NextResponse.json({ ok: false, error: error.message }, { status: 500 }));
      });

      busboy.on('finish', () => {
        // handled by ws close event
        console.log('[API] Busboy finished processing.');
      });

      if (!req.body) {
        resolve(NextResponse.json({ ok: false, error: "No body" }, { status: 400 }));
        return;
      }
      webStreamToNodeStream(req.body).pipe(busboy);
    } catch (err) {
      console.error('[API] Unexpected error:', err);
      reject(NextResponse.json({ ok: false, error: 'Unexpected error' }, { status: 500 }));
    }
  });
}

async function createGuestUser(backgroundMode) {
  const nowAsNumber = Date.now();
  // User erstellen
  const guestName = `g_${nowAsNumber}`;
  const newUser = new User({
    name: guestName,
    email: guestName + '@edifacts.com',
    password: randomUUID(),
    tosAccepted: true,
    theme: { backgroundMode: backgroundMode || 'white' },
  });
  await dbConnect();
  await newUser.save();
  // Token generieren
  await newUser.generateAuthToken('web');
  return newUser;
}
