import "dotenv/config";
import express from "express";
import http from "http";
import next from "next";
import { Server } from "socket.io";

import socketAuth from "./socketproxy.js";

// Tool Registry initialization
import { initializeToolRegistry } from "./lib/ai/tools/init.js";

import { SessionContext } from "./lib/socket/sessionContext.js";

// Socket.IO event handlers
import { registerAgentHandlers } from "./lib/socket/handlers/agentHandlers.js";
import { registerJobHandlers } from "./lib/socket/handlers/jobHandlers.js";

const app = next({ dev: process.env.NODE_ENV !== "production" });
const handler = app.getRequestHandler(app);
const PORT = process.env.PORT || 3010;

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
        // SessionContext erstellt und verwaltet ALLE Agents + Events
        socket.sessionContext = new SessionContext(socket);

        // Register event handlers
        registerJobHandlers(socket);
        registerAgentHandlers(socket);

        // Socket event listeners
        socket.on('disconnect', () => handleDisconnect(socket));

        // Error handler for uncaught errors in handlers
        socket.on('error', (error) => handleError(socket, error));
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
    socket.sessionContext.cleanup();
}

function handleError(socket, error) {
    console.error(`[Socket ${socket.id}] Error:`, error);
    //socket.sessionContext?.cleanup(); //dont cleanup listeners on error
}