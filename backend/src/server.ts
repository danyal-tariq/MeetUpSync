//! Server for video calls, chat, and screen sharing using WebRTC
// To manage WebRTC communication, handle these message types:

// Offer: Sent when a user wants to start a call (initiate WebRTC).
// Answer: Sent in response to an offer (to accept the call).
// ICE candidates: Sent to exchange ICE candidate information for establishing peer-to-peer connectivity.

// We will use the WebSocket protocol to exchange these messages between clients and the server.
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';

interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
}
import http from 'http';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const PORT = process.env.PORT || 5000;
const app = express();
const server = http.createServer(app);

// Enable CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  next();
});

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Store clients
const clients: Map<string, ExtWebSocket> = new Map();

const sendMessageToClient = (
  message: string,
  targetClient: ExtWebSocket,
  targetId: string
) => {
  targetClient.send(message);
  console.log('Message sent to: ', targetId);
};

const handleClientNotFound = (sender: WebSocket) => {
  sender.send(JSON.stringify({ type: 'error', data: 'Client not found' }));
  console.log('Client not found');
};

const broadcastMessageToAll = (
  message: string,
  sender: WebSocket,
  senderId: string
) => {
  console.log(`Message sent to all clients from: ${senderId}`);
  clients.forEach((client) => {
    if (client !== sender) {
      client.send(message);
      console.log('Message sent to client');
    }
  });
};

const broadcastMessage = (
  message: string,
  sender: WebSocket,
  targetId?: string
) => {
  console.log('Broadcasting message: ', message);
  if (targetId) {
    const targetClient = clients.get(targetId);
    if (targetClient) {
      sendMessageToClient(message, targetClient, targetId);
    } else {
      handleClientNotFound(sender);
    }
  } else {
    const senderId = Array.from(clients.entries()).find(
      ([key, client]) => client === sender
    )?.[0];
    if (senderId) {
      broadcastMessageToAll(message, sender, senderId);
    }
  }
};

const generateUniqueId = () => {
  return uuidv4();
};

wss.on('connection', (ws: ExtWebSocket) => {
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
  const existingClients = Array.from(clients.keys()).filter(
    (clientId) => clientId !== id
  );
  ws.send(JSON.stringify({ type: 'existing-clients', data: existingClients }));

  //listen for messages from the client
  ws.on('message', (message: string) => {
    try {
      const parsedMessage = JSON.parse(message);
      const { type, reciever, data } = parsedMessage;

      //send message to specific client
      if (reciever) {
        broadcastMessage(
          JSON.stringify({ type: 'message', data: data, sender: id }),
          ws,
          reciever
        );
        return;
      } else {
        //send message to all clients
        broadcastMessage(
          JSON.stringify({
            type: 'message',
            data: data,
            sender: id,
          }),
          ws
        );
      }
    } catch (error) {
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
