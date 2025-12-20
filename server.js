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

    io.use(socketAuth);

    // Socket connection handler
    io.on('connection', async socket => {
        // Handle connection
        //await handleConnection(socket);

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