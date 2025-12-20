import next from "next";
import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";

import socketAuth from "./socketproxy.js";

const app = next({ dev: process.env.NODE_ENV !== "production" });
const handler = app.getRequestHandler(app);
const PORT = process.env.PORT || 3010;

app.prepare().then(() => {
    const expressApp = express();
    const server = http.createServer(expressApp);

    // Initialize Socket.IO
    const io = new Server(server, {
        cors: { origin: '*', methods: ['GET', 'POST'] },
        maxHttpBufferSize: 1e8
    });

    // Make io globally available for Worker broadcasts
    global.io = io;

    io.use(socketAuth);

    // Socket connection handler
    io.on('connection', async socket => {
        console.log(`Socket connected: ${socket.id}`);

        // Subscribe to job updates
        socket.on('subscribe', ({ jobId }) => {
            if (!jobId) {
                console.warn(`[Socket ${socket.id}] Subscribe failed: missing jobId`);
                return;
            }
            console.log(`[Socket ${socket.id}] Subscribing to job: ${jobId}`);
            socket.join(`job:${jobId}`);
            socket.emit('subscribed', { jobId });
        });

        // Unsubscribe from job updates
        socket.on('unsubscribe', ({ jobId }) => {
            if (!jobId) {
                console.warn(`[Socket ${socket.id}] Unsubscribe failed: missing jobId`);
                return;
            }
            console.log(`[Socket ${socket.id}] Unsubscribing from job: ${jobId}`);
            socket.leave(`job:${jobId}`);
            socket.emit('unsubscribed', { jobId });
        });

        // Socket event listeners
        socket.on('disconnect', () => handleDisconnect(socket));
    });

    // Express configuration
    expressApp.set('trust proxy', true);

    // Next.js handler for all other routes
    expressApp.use((req, res) => {
        return handler(req, res);
    });

    // Start server
    console.log(`Listening Server on port ${PORT}!`);
    server.listen(PORT);
});

function handleDisconnect(socket) {
    const authenticatedUser = socket.authenticatedUser;
    const anonId = socket.anonId;

    console.log(`Socket disconnected: ${socket.id} => (${authenticatedUser?.name || anonId})`);

    /*if (authenticatedUser !== undefined && authenticatedUser !== null) {
      authenticatedUser.isUserOnline = false;
      authenticatedUser.save();
    }

    this.matchmakingQueue.delete(socket.id);*/
}