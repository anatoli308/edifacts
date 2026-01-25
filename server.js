import next from "next";
import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";

import socketAuth from "./socketproxy.js";

import dbConnect from "./lib/dbConnect.js";
import User from "./models/shared/User.js";

// Tool Registry initialization
import { initializeToolRegistry } from "./lib/ai/tools/init.js";

// Socket.IO event handlers
import { registerAgentHandlers } from "./lib/socket/handlers/agentHandlers.js";
import { registerJobHandlers } from "./lib/socket/handlers/jobHandlers.js";

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
        const authenticatedUser = await getAuthenticatedUser(socket.userId, socket.token);
        if (authenticatedUser) {
            authenticatedUser.isOnline = true;
            await authenticatedUser.save();
        }
        console.log(`Socket connected: ${socket.id}  => (${authenticatedUser?._id || "unknown"})`);

        // Register event handlers
        registerJobHandlers(socket, authenticatedUser);
        registerAgentHandlers(socket, authenticatedUser);

        // Socket event listeners
        socket.on('disconnect', () => handleDisconnect(socket, authenticatedUser));
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

async function handleDisconnect(socket, authenticatedUser) {
    if (authenticatedUser) {
        authenticatedUser.isOnline = false;
        await authenticatedUser.save();
    }
    console.log(`Socket disconnected: ${socket.id} => (${authenticatedUser?._id || "unknown"})`);
}