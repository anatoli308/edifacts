import next from "next";
import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";

import socketAuth from "./socketproxy.js";

import dbConnect from "./lib/dbConnect.js";
import User from "./models/User.js";

const app = next({ dev: process.env.NODE_ENV !== "production" });
const handler = app.getRequestHandler(app);
const PORT = process.env.PORT || 3010;

async function getAuthenticatedUser(userId, token) {
    if (!userId) return null;
    await dbConnect();
    const user = await User.findOne({ _id: userId, "tokens.token": token });
    if (!user || user.banned) return null;
    return user;
}

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
        const authenticatedUser = await getAuthenticatedUser(socket.userId, socket.token);
        if (authenticatedUser) {
            authenticatedUser.isOnline = true;
            await authenticatedUser.save();
        }
        console.log(`Socket connected: ${socket.id}  => (${authenticatedUser?._id || "unknown"})`);

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

async function handleDisconnect(socket) {
    const authenticatedUser = await getAuthenticatedUser(socket.userId, socket.token);
    if (authenticatedUser) {
        authenticatedUser.isOnline = false;
        await authenticatedUser.save();
    }
    console.log(`Socket disconnected: ${socket.id} => (${authenticatedUser?._id || "unknown"})`);
}