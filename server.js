import "dotenv/config";
import express from "express";
import http from "http";
import next from "next";
import { Server } from "socket.io";

import socketAuth from "./socketproxy.js";

import { getAuthenticatedUser } from "./lib/auth.js";

// Tool Registry initialization
import { initializeToolRegistry } from "./lib/ai/tools/init.js";

// Socket.IO event handlers
import { registerAgentHandlers } from "./lib/socket/handlers/agentHandlers.js";
import { registerJobHandlers } from "./lib/socket/handlers/jobHandlers.js";

const app = next({ dev: process.env.NODE_ENV !== "production" });
const handler = app.getRequestHandler(app);
const PORT = process.env.PORT || 3010;

async function updateUserOnlineStatus(socket, isOnline) {
    const authenticatedUser = await getAuthenticatedUser(socket.userId, socket.token);
    if (authenticatedUser) {
        authenticatedUser.isOnline = isOnline;
        await authenticatedUser.save();
    }
    const status = isOnline ? "connected" : "disconnected";
    console.log(`Socket ${status}: ${socket.id} => (${authenticatedUser?.name || "guest"})`);
    return authenticatedUser;
}

app.prepare().then(async () => {
    // Initialize Tool Registry before starting server
    const toolRegistryStatus = await initializeToolRegistry();
    if (!toolRegistryStatus.success) {
        console.warn('⚠ Tool Registry initialization had issues:', toolRegistryStatus);
    } else {
        console.log('✓ Tool Registry initialized:', toolRegistryStatus);
    }

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
        await updateUserOnlineStatus(socket, true);

        // Register event handlers
        registerJobHandlers(socket);
        registerAgentHandlers(socket);

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
    await updateUserOnlineStatus(socket, false);
}