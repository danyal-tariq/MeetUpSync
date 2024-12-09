"use strict";
//! Server for video calls, chat, and screen sharing using WebRTC
// To manage WebRTC communication, handle these message types:
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Offer: Sent when a user wants to start a call (initiate WebRTC).
// Answer: Sent in response to an offer (to accept the call).
// ICE candidates: Sent to exchange ICE candidate information for establishing peer-to-peer connectivity.
// We will use the WebSocket protocol to exchange these messages between clients and the server.
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const http_1 = __importDefault(require("http"));
const dotenv_1 = __importDefault(require("dotenv"));
const uuid_1 = require("uuid");
dotenv_1.default.config();
const PORT = process.env.PORT || 5000;
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
// Enable CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    next();
});
// Create WebSocket server
const wss = new ws_1.WebSocketServer({ server });
// Store clients
const clients = new Map();
const sendMessageToClient = (message, targetClient, targetId) => {
    targetClient.send(message);
    console.log('Message sent to: ', targetId);
};
const handleClientNotFound = (sender) => {
    sender.send(JSON.stringify({ type: 'error', data: 'Client not found' }));
    console.log('Client not found');
};
const broadcastMessageToAll = (message, sender, senderId) => {
    console.log(`Message sent to all clients from: ${senderId}`);
    clients.forEach((client) => {
        if (client !== sender) {
            client.send(message);
            console.log('Message sent to client');
        }
    });
};
const broadcastMessage = (message, sender, targetId) => {
    var _a;
    console.log('Broadcasting message: ', message);
    if (targetId) {
        const targetClient = clients.get(targetId);
        if (targetClient) {
            sendMessageToClient(message, targetClient, targetId);
        }
        else {
            handleClientNotFound(sender);
        }
    }
    else {
        const senderId = (_a = Array.from(clients.entries()).find(([key, client]) => client === sender)) === null || _a === void 0 ? void 0 : _a[0];
        if (senderId) {
            broadcastMessageToAll(message, sender, senderId);
        }
    }
};
const generateUniqueId = () => {
    return (0, uuid_1.v4)();
};
wss.on('connection', (ws) => {
    const id = generateUniqueId();
    clients.set(id, ws);
    ws.isAlive = true;
    // Handle `pong` responses from the client
    ws.on('pong', () => {
        console.log('Pong received from client');
        ws.isAlive = true;
    });
    ws.send(JSON.stringify({ type: 'connection', data: 'Connected to server' }));
    // Notify other clients that a new client has connected and send the new client's id
    broadcastMessage(JSON.stringify({ type: 'new-connection', data: id }), ws);
    //Notify the new client of its id
    ws.send(JSON.stringify({ type: 'id', data: id }));
    // Inform the new client of existing clients
    const existingClients = Array.from(clients.keys()).filter((clientId) => clientId !== id);
    ws.send(JSON.stringify({ type: 'existing-clients', data: existingClients }));
    //listen for messages from the client
    ws.on('message', (message) => {
        try {
            const parsedMessage = JSON.parse(message);
            const { type, reciever, data } = parsedMessage;
            //send message to specific client
            if (reciever) {
                broadcastMessage(JSON.stringify({ type: 'message', data: data, sender: id }), ws, reciever);
                return;
            }
            else {
                //send message to all clients
                broadcastMessage(JSON.stringify({
                    type: 'message',
                    data: data,
                    sender: id,
                }), ws);
            }
        }
        catch (error) {
            console.log('Error parsing message: ', error);
        }
    });
    // Periodically check the health of connections
    const interval = setInterval(() => {
        console.log('Checking connection health');
        clients.forEach((ws) => {
            if (!ws.isAlive) {
                console.log('Terminating unresponsive connection');
                return ws.terminate();
            }
            ws.isAlive = false; // Mark as unresponsive until pong is received
            ws.ping();
        });
    }, 30000); // Check every 60 seconds
    //listen for client disconnection
    ws.on('close', () => {
        console.log('Client disconnected');
        broadcastMessage(JSON.stringify({ type: 'disconnection', data: id }), ws);
        clients.delete(id);
        clearInterval(interval);
    });
});
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
