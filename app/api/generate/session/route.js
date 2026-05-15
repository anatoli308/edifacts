import Busboy from 'busboy';
import { createWriteStream, existsSync, unlinkSync } from 'fs';
import { mkdir } from 'fs/promises';
import { NextResponse } from 'next/server';
import path from 'path';
import { Readable } from 'stream';
import { Worker } from 'worker_threads';
import { randomUUID } from 'crypto';

import { getAuthenticatedUser, createGuestUser } from '@/lib/auth';
import { loadDefaultSystemApiKey } from '@/lib/ai/providers/index.js';
import { userRepo, apiKeyRepo, chatRepo, fileRepo } from '@/lib/db/repositories';

// ==================== INITIAL SETUP ====================

const jobs = new Map();
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// ==================== VALIDATION ====================

function validateContentType(req) {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    throw new Error('Content-Type must be multipart/form-data');
  }
}

function validateFileExtension(filename) {
  // TODO: enforce extension whitelist
  return true;
}

// ==================== HELPERS ====================

function webStreamToNodeStream(webStream) {
  const reader = webStream.getReader();
  return new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) this.push(null);
      else this.push(Buffer.from(value));
    }
  });
}

async function writeFileAtomically(stream, targetPath, sizeRef) {
  return new Promise((resolve, reject) => {
    const ws = createWriteStream(targetPath);
    stream.on('data', chunk => { sizeRef.size += chunk.length; });
    stream.pipe(ws);
    ws.on('close', () => {
      console.log(`[API] File saved to: ${targetPath} (${sizeRef.size} bytes)`);
      resolve();
    });
    ws.on('error', (err) => {
      console.error('[API] File write error:', err.message);
      reject(err);
    });
  });
}

// ==================== USER & ENTITY CREATION ====================

/**
 * Creates the trio (chat, file, optional system api key) in a transaction.
 * Pre-generates UUIDs to resolve the circular FK between Chat.fileId (via
 * domainContext.edifact.fileId) and File.chatId.
 *
 * Caller must already have a persisted authenticatedUser (guest or real).
 */
async function createEntities(authenticatedUser, fileInfo, edifactContext) {
  const chatId = randomUUID();
  const fileId = randomUUID();
  const filePath = path.join(UPLOAD_DIR, `${chatId}.edi`);

  // ApiKey: prefer user's own; otherwise persist the system default for them
  let apiKey = await apiKeyRepo.findFirstForOwner(authenticatedUser.id);
  let createdApiKeyId = null;
  if (!apiKey) {
    const systemKey = await loadDefaultSystemApiKey();
    apiKey = await apiKeyRepo.create({
      ownerId: authenticatedUser.id,
      provider: systemKey.provider,
      name: systemKey.name,
      encryptedKey: systemKey.encryptedKey,
      baseUrl: systemKey.baseUrl,
      models: systemKey.models || [],
    });
    createdApiKeyId = apiKey.id;
  }

  const domainContext = {
    edifact: {
      subset: edifactContext.subset,
      fileId,
      messageType: edifactContext.messageType,
      releaseVersion: edifactContext.releaseVersion,
      standardFamily: edifactContext.standardFamily,
    }
  };

  const chat = await chatRepo.create({
    id: chatId,
    name: 'My EDIFACT Analysis',
    creatorId: authenticatedUser.id,
    selectedModel: 'gpt-oss:120b-cloud',
    apiKeyRef: apiKey.id,
    settings: {},
    domainContext,
  });

  const newFile = await fileRepo.create({
    id: fileId,
    ownerId: authenticatedUser.id,
    chatId,
    originalName: fileInfo.filename || 'upload.edi',
    path: filePath,
    size: 0,
    mimetype: fileInfo.mimeType || 'application/octet-stream',
    storage: 'local',
    status: 'processing',
    metadata: { storageName: `${chatId}.edi` },
  });

  return {
    chat,
    newFile,
    createdIds: {
      apiKeyId: createdApiKeyId,
      chatId: chat.id,
      fileId: newFile.id,
    },
  };
}

// ==================== WORKER MANAGEMENT ====================

function setupWorker(newFile, chat, authenticatedUser, authToken, resolve, reject) {
  const workerPath = path.resolve(process.cwd(), '_workers/edifactParser.worker.js');
  const worker = new Worker(workerPath);
  const jobId = chat.id;

  jobs.set(jobId, {
    jobId,
    status: 'processing',
    worker,
    filePath: newFile.path,
    startedAt: new Date(),
  });

  worker.on('message', async (msg) => {
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
      try {
        await fileRepo.update(newFile.id, { status: 'complete' });
      } catch (err) {
        console.error(`[API] Failed to update file status:`, err.message);
      }

      if (msg.analysis) {
        try {
          await chatRepo.setEdifactAnalysis(jobId, msg.analysis);
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
      try {
        await fileRepo.update(newFile.id, {
          status: 'error',
          metadata: { ...(newFile.metadata || {}), error: msg.error },
        });
      } catch (err) {
        console.error('[API] Failed to update file error status:', err.message);
      }

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
    try {
      await fileRepo.update(newFile.id, {
        status: 'error',
        metadata: { ...(newFile.metadata || {}), error: error.message },
      });
    } catch (err) {
      console.error('[API] Failed to update file error status:', err.message);
    }

    if (global.io) {
      global.io.to(`job:${jobId}`).emit('error', { jobId, error: error.message });
    }
  });

  worker.postMessage({
    chat,
    file: newFile,
    user: userRepo.toPublicJSON(authenticatedUser),
  });

  resolve(NextResponse.json({
    ok: true,
    jobId,
    message: 'Processing started. Subscribe to job updates via WebSocket.',
    token: authToken,
  }, { status: 202 }));
}

// ==================== ERROR HANDLING ====================

async function handleManualRollback(createdIds, reason) {
  console.log(`[API] Manual rollback: ${reason}`);

  // Order: File → Chat → ApiKey. User rollback omitted; guest users persist
  // independently and may already have other associations by the time we get
  // here. Cascade deletes handle Chat→Message/File, so File deletion alone is
  // belt-and-suspenders if the chat is going away.
  if (createdIds.fileId) {
    try { await fileRepo.remove(createdIds.fileId); }
    catch (err) { console.error('[API] Rollback file:', err.message); }
  }
  if (createdIds.chatId) {
    try { await chatRepo.remove(createdIds.chatId); }
    catch (err) { console.error('[API] Rollback chat:', err.message); }
  }
  if (createdIds.apiKeyId) {
    try { await apiKeyRepo.remove(createdIds.apiKeyId); }
    catch (err) { console.error('[API] Rollback apiKey:', err.message); }
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
    let createdIds = { apiKeyId: null, chatId: null, fileId: null };

    try {
      validateContentType(req);
      if (!req.body) {
        return resolve(NextResponse.json({ ok: false, error: "No body" }, { status: 400 }));
      }

      if (!existsSync(UPLOAD_DIR)) {
        await mkdir(UPLOAD_DIR, { recursive: true });
      }

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
          const userId = req.headers.get('x-user-id');
          const token = req.headers.get('x-auth-token');
          let authenticatedUser = await getAuthenticatedUser(userId, token);
          let issuedToken = token;

          if (!authenticatedUser) {
            authenticatedUser = await createGuestUser(backgroundMode);
            issuedToken = await userRepo.issueToken(authenticatedUser.id, 'web');
          }

          console.log('[API] authenticated user:', authenticatedUser.id);
          console.log('[API] edifactContext from form data:', edifactContext);

          const filename = fileInfo.filename || 'upload.edi';
          if (!validateFileExtension(filename)) {
            file.resume();
            return resolve(NextResponse.json({
              ok: false,
              error: 'Unsupported file type.'
            }, { status: 400 }));
          }

          const { chat, newFile, createdIds: ids } = await createEntities(
            authenticatedUser,
            fileInfo,
            edifactContext
          );
          createdIds = ids;
          console.log(`[API] Entities saved for job ${chat.id}`);

          // Stream upload to disk; track size in a mutable ref then persist.
          const sizeRef = { size: 0 };
          try {
            await writeFileAtomically(file, newFile.path, sizeRef);
            await fileRepo.update(newFile.id, { size: sizeRef.size });
            newFile.size = sizeRef.size;
          } catch (writeErr) {
            console.error('[API] File write failed:', writeErr.message);
            await cleanupFile(newFile.path);
            await handleManualRollback(createdIds, 'file write error');
            return reject(NextResponse.json({
              ok: false,
              error: writeErr.message
            }, { status: 500 }));
          }

          setupWorker(newFile, chat, authenticatedUser, issuedToken, resolve, reject);

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

      webStreamToNodeStream(req.body).pipe(busboy);

    } catch (err) {
      await handleManualRollback(createdIds, 'critical error');
      console.error('[API] Unexpected error:', err);
      reject(NextResponse.json({ ok: false, error: err.message || 'Unexpected error' }, { status: 500 }));
    }
  });
}
