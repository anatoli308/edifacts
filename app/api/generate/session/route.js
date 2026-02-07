import Busboy from 'busboy';
import { randomUUID } from 'crypto';
import { createWriteStream, existsSync, unlinkSync } from 'fs';
import { mkdir } from 'fs/promises';
import { NextResponse } from 'next/server';
import path from 'path';
import { Readable } from 'stream';
import { Worker } from 'worker_threads';

//app imports
import { getAuthenticatedUser } from '@/app/lib/auth';
import {loadDefaultSystemApiKey} from '@/app/lib/ai/providers/index.js';
import AnalysisChat from '@/app/models/shared/AnalysisChat';
import User from '@/app/models/shared/User';
import dbConnect from '@/app/lib/dbConnect';
import File from '@/app/models/shared/File';
import ApiKey from '@/app/models/shared/ApiKey';

// ==================== INITIAL SETUP ====================

const jobs = new Map();
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const ALLOWED_EXTENSIONS = ['.edi', '.edifact', '.txt'];

// ==================== VALIDATION ====================

function validateContentType(req) {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    throw new Error('Content-Type must be multipart/form-data');
  }
}

function validateFileExtension(filename) {
  //TODO: for now we accept them all
  return true; //ALLOWED_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext));
}

// ==================== HELPERS ====================

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

// Atomare File-Write-Funktion mit Promise-Wrapper
async function writeFileAtomically(stream, targetPath, fileModel) {
  return new Promise((resolve, reject) => {
    const ws = createWriteStream(targetPath);

    stream.on('data', chunk => {
      fileModel.size += chunk.length;
    });

    stream.pipe(ws);

    ws.on('close', () => {
      console.log(`[API] File saved to: ${targetPath} (${fileModel.size} bytes)`);
      resolve();
    });

    ws.on('error', (err) => {
      console.error('[API] File write error:', err.message);
      reject(err);
    });
  });
}

// ==================== USER & ENTITY CREATION ====================

async function createGuestUser(backgroundMode) {
  const nowAsNumber = Date.now();
  const guestName = `g_${nowAsNumber}`;
  const newUser = new User({
    name: guestName,
    email: guestName + '@edifacts.com',
    password: randomUUID(),
    tosAccepted: true,
    theme: { backgroundMode: backgroundMode || 'white' },
  });
  return newUser;
}

async function createEntities(authenticatedUser, fileInfo, edifactContext) {
  await dbConnect();
  const newFile = new File({
    ownerId: authenticatedUser._id,
    originalName: fileInfo.filename || 'upload.edi',
    mimeType: fileInfo.mimeType || 'application/octet-stream',
    metadata: {}
  });

  let apiKeyForUser = await ApiKey.findOne({ ownerId: authenticatedUser._id });
  if (!apiKeyForUser) {
    apiKeyForUser = await loadDefaultSystemApiKey();
  }

  const chat = new AnalysisChat({
    name: 'My EDIFACT Analysis', // TODO: LLM generieren lassen basierend auf Datei- und Kontextinformationen
    creatorId: authenticatedUser._id.toString(),
    selectedModel: 'gpt-oss:120b-cloud', // TODO: model selected from apiKeyForUser
    apiKeyRef: apiKeyForUser._id,
    domainContext: {
      edifact: {
        subset: edifactContext.subset,
        fileId: newFile._id,
        messageType: edifactContext.messageType,
        releaseVersion: edifactContext.releaseVersion,
        standardFamily: edifactContext.standardFamily,
      }
    }
  });

  const jobId = chat._id.toString();
  const filePath = path.join(UPLOAD_DIR, `${jobId}.edi`);

  newFile.path = filePath;
  newFile.chatId = chat._id;
  newFile.status = 'processing';

  // WICHTIG: Reihenfolge der Saves (ohne Transaction)
  // 1. User (falls neu)
  const isNewUser = authenticatedUser.isNew;
  if (isNewUser) {
    await authenticatedUser.save();
  }

  // 2. ApiKey (falls neu)
  const isNewApiKey = apiKeyForUser.isNew;
  if (isNewApiKey) {
    await apiKeyForUser.save();
  }

  // 3. Chat (braucht User + ApiKey)
  await chat.save();

  // 4. File (braucht Chat)
  await newFile.save();

  if (isNewUser) {
    // 5. Auth-Token generieren
    await authenticatedUser.generateAuthToken('web');
  }
  
  return {
    chat, newFile, createdIds: {
      userId: isNewUser ? authenticatedUser._id : null,
      apiKeyId: isNewApiKey ? apiKeyForUser._id : null,
      chatId: chat._id,
      fileId: newFile._id
    }
  };
}

// ==================== WORKER MANAGEMENT ====================

function setupWorker(newFile, chat, authenticatedUser, resolve, reject) {
  const workerPath = path.resolve(process.cwd(), '_workers/edifactParser.worker.js');
  const worker = new Worker(workerPath);
  const jobId = chat._id.toString();

  jobs.set(jobId, {
    jobId,
    status: 'processing',
    worker,
    filePath: newFile.path,
    startedAt: new Date(),
  });

  worker.on('message', async (msg) => {
    console.log(`[API] Message from worker for job ${jobId}:`, msg);

    if (msg.type === 'progress' && global.io) {
      global.io.to(`job:${jobId}`).emit('progress', {
        jobId, percent: msg.percent, message: msg.message
      });
    }
    else if (msg.type === 'complete') {
      const job = jobs.get(jobId);
      if (job) {
        job.status = 'complete';
        job.result = msg.result;
        job.completedAt = new Date();
      }
      newFile.status = 'complete';
      await newFile.save();

      // Save _analysis to AnalysisChat
      if (msg.analysis) {
        try {
          await AnalysisChat.findByIdAndUpdate(
            jobId,
            { $set: { 'domainContext.edifact._analysis': msg.analysis } },
            { new: true }
          );
          console.log(`[API] Saved _analysis to chat ${jobId} (${msg.analysis.segmentCount} segments, status: ${msg.analysis.status})`);
        } catch (analysisError) {
          console.error(`[API] Failed to save _analysis for chat ${jobId}:`, analysisError.message);
        }
      }

      if (global.io) {
        global.io.to(`job:${jobId}`).emit('complete', { jobId, result: msg.result });
      }
      worker.terminate();
    }
    else if (msg.type === 'error') {
      const job = jobs.get(jobId);
      if (job) {
        job.status = 'error';
        job.error = msg.error;
      }
      newFile.status = 'error';
      newFile.metadata.error = msg.error;
      await newFile.save();

      if (global.io) {
        global.io.to(`job:${jobId}`).emit('error', { jobId, error: msg.error });
      }
      worker.terminate();
    }
  });

  worker.on('error', async (error) => {
    console.error(`[API] Worker error for job ${jobId}:`, error.message);
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'error';
      job.error = error.message;
    }
    newFile.status = 'error';
    newFile.metadata.error = error.message;
    await newFile.save();

    if (global.io) {
      global.io.to(`job:${jobId}`).emit('error', { jobId, error: error.message });
    }
  });

  worker.postMessage({
    chat: chat.toJSON(),
    file: newFile.toJSON(),
    user: authenticatedUser.toJSON()
  });

  resolve(NextResponse.json({
    ok: true,
    jobId,
    message: 'Processing started. Subscribe to job updates via WebSocket.',
    token: authenticatedUser.tokens[authenticatedUser.tokens.length - 1].token,
  }, { status: 202 }));
}

// ==================== ERROR HANDLING ====================

async function handleManualRollback(createdIds, reason) {
  console.log(`[API] Manual rollback: ${reason}`);

  // Rollback in umgekehrter Reihenfolge: File → Chat → ApiKey → User
  if (createdIds.fileId) {
    try {
      await File.deleteOne({ _id: createdIds.fileId });
      console.log(`[API] Rolled back file ${createdIds.fileId}`);
    } catch (err) {
      console.error('[API] Error rolling back file:', err.message);
    }
  }

  if (createdIds.chatId) {
    try {
      await AnalysisChat.deleteOne({ _id: createdIds.chatId });
      console.log(`[API] Rolled back chat ${createdIds.chatId}`);
    } catch (err) {
      console.error('[API] Error rolling back chat:', err.message);
    }
  }

  if (createdIds.apiKeyId) {
    try {
      await ApiKey.deleteOne({ _id: createdIds.apiKeyId });
      console.log(`[API] Rolled back apiKey ${createdIds.apiKeyId}`);
    } catch (err) {
      console.error('[API] Error rolling back apiKey:', err.message);
    }
  }

  if (createdIds.userId) {
    try {
      await User.deleteOne({ _id: createdIds.userId });
      console.log(`[API] Rolled back user ${createdIds.userId}`);
    } catch (err) {
      console.error('[API] Error rolling back user:', err.message);
    }
  }
}

async function cleanupFile(filePath) {
  if (filePath && existsSync(filePath)) {
    try {
      unlinkSync(filePath);
      console.log('[API] Temporary file deleted:', filePath);
    } catch (fsErr) {
      console.error('[API] Error deleting temporary file:', fsErr.message);
    }
  }
}

// ==================== MAIN HANDLER ====================
export async function POST(req) {
  return new Promise(async (resolve, reject) => {
    let createdIds = { userId: null, apiKeyId: null, chatId: null, fileId: null };

    try {
      // 1. Validierung
      validateContentType(req);

      if (!req.body) {
        return resolve(NextResponse.json({ ok: false, error: "No body" }, { status: 400 }));
      }

      // 2. Upload-Verzeichnis sicherstellen
      if (!existsSync(UPLOAD_DIR)) {
        await mkdir(UPLOAD_DIR, { recursive: true });
      }

      // 3. Busboy setup
      const busboy = Busboy({ headers: Object.fromEntries(req.headers) });
      const edifactContext = {
        standardFamily: null,
        subset: null,
        releaseVersion: null,
        messageType: null,
      };

      let backgroundMode = null;
      busboy.on('field', (field, val) => {
        if (field === 'standardFamily') edifactContext.standardFamily = val;
        if (field === 'subset') edifactContext.subset = val;
        if (field === 'releaseVersion') edifactContext.releaseVersion = val;
        if (field === 'messageType') edifactContext.messageType = val;
        if (field === 'backgroundMode') backgroundMode = val;
      });

      busboy.on('file', async (fieldname, file, fileInfo) => {

        try {
          // 4. User authentifizieren/erstellen
          const userId = req.headers.get('x-user-id');
          const token = req.headers.get('x-auth-token');
          let authenticatedUser = await getAuthenticatedUser(userId, token);
          console.log('[API] authenticated user:', authenticatedUser ? authenticatedUser._id.toString() : 'unknown');
          console.log('[API] edifactContext from form data:', edifactContext);

          if (!authenticatedUser) {
            authenticatedUser = await createGuestUser(backgroundMode);
          }

          // 5. File-Extension validieren
          const filename = fileInfo.filename || 'upload.edi';
          if (!validateFileExtension(filename)) {
            file.resume();
            return resolve(NextResponse.json({
              ok: false,
              error: 'Unsupported file type.'
            }, { status: 400 }));
          }

          // 6. Entitäten erstellen und speichern
          const { chat, newFile, createdIds: ids } = await createEntities(
            authenticatedUser,
            fileInfo,
            edifactContext
          );
          createdIds = ids;

          console.log(`[API] Entities saved for job ${chat._id}`);

          // 7. File schreiben
          try {
            await writeFileAtomically(file, newFile.path, newFile);
          } catch (writeErr) {
            console.error('[API] File write failed:', writeErr.message);
            await cleanupFile(newFile.path);
            await handleManualRollback(createdIds, 'file write error');
            return reject(NextResponse.json({
              ok: false,
              error: writeErr.message
            }, { status: 500 }));
          }

          // 8. Worker starten
          setupWorker(newFile, chat, authenticatedUser, resolve, reject);

        } catch (err) {
          await handleManualRollback(createdIds, 'file processing error');
          file.resume();
          console.error('[API] Error in file handler:', err.message);
          reject(NextResponse.json({ ok: false, error: err.message }, { status: 500 }));
        }
      });

      busboy.on('error', async (error) => {
        await handleManualRollback(createdIds, 'busboy error');
        console.error('[API] Busboy error:', error);
        reject(NextResponse.json({ ok: false, error: error.message }, { status: 500 }));
      });

      busboy.on('finish', () => {
        console.log('[API] Busboy finished processing.');
      });

      // 9. Stream starten
      webStreamToNodeStream(req.body).pipe(busboy);

    } catch (err) {
      await handleManualRollback(createdIds, 'critical error');
      console.error('[API] Unexpected error:', err);
      reject(NextResponse.json({ ok: false, error: err.message || 'Unexpected error' }, { status: 500 }));
    }
  });
}
