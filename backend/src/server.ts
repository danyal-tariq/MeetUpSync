import express from 'express';
import http from 'http';
import socketIo from 'socket.io';
import { Socket } from 'socket.io';
import mongoose from 'mongoose';
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const friendRoutes = require('./routes/friend');
const chatRoutes = require('./routes/chat');
const User = require('./models/User');
const Message = require('./models/Message');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
export const io = new socketIo.Server(server, {
  cors: { origin: 'http://localhost:8080', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/chat', chatRoutes);

mongoose.connect(process.env.MONGODB_URL ?? '').then(() => console.log('MongoDB connected'));

// Middleware to authenticate socket connections
io.use((socket, next) => {
  const token = socket.handshake.query.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    (socket as SocketWithUser).user = decoded;
    next();
  } catch (err) {
  }
});

interface SocketWithUser extends Socket {
  user: any;
}

// Socket.io events
io.on('connection', async (socket) => {
  const userSocket = socket as SocketWithUser;
  console.log(`User connected: ${userSocket.user.username}`);
  await User.findByIdAndUpdate(userSocket.user.id, { online: true });

  io.to(userSocket.id).emit('connected', { id: userSocket.user.id, username: userSocket.user.username });

  userSocket.on('joinRoom', (room) => {
    userSocket.join(room);
    const usersInRoom = Array.from(io.sockets.adapter.rooms.get(room) || [])
      .map((id) => {
        const socket = io.sockets.sockets.get(id) as SocketWithUser;
        return socket?.user?.username;
      })
      .filter(Boolean);
    io.to(room).emit('updateOnlineStatus', usersInRoom);
  });

  userSocket.on('sendMessage', async (data) => {
    const { recipientType, recipientId, text } = data;
    const senderId = userSocket.user.id;

    const message = new Message({
      sender: senderId,
      recipient: recipientType === 'user' ? recipientId : null,
      room: recipientType === 'room' ? recipientId : null,
      text,
    });
    await message.save();

    if (recipientType === 'user') {
      const recipientSocket = findSocketByUserId(recipientId);
      if (recipientSocket) {
        io.to(recipientSocket.id).emit('newMessage', {
          sender: userSocket.user.username,
          text,
          timestamp: message.timestamp,
        });
      }
    } else if (recipientType === 'room') {
      io.to(recipientId).emit('newMessage', {
        sender: userSocket.user.username,
        text,
        timestamp: message.timestamp,
      });
    }
  });

  userSocket.on('sendFriendRequest', async (data) => {
    const from = userSocket.user.id;
    console.log('Sending to:', data.to);
    const recipientSocket = findSocketByUserId(data.to);
    if (recipientSocket) {
      console.log('Sending friend request to:', recipientSocket.user.username);
      io.to(recipientSocket.id).emit('friendRequest', {
        from: userSocket.user.username,
        id: from,
        message: `${userSocket.user.username} sent you a friend request!`,
      });
    }
  });

  userSocket.on('disconnect', async () => {
    console.log(`User disconnected: ${userSocket.user.username}`);
    await User.findByIdAndUpdate(userSocket.user.id, { online: false });
  })
});


function findSocketByUserId(userId: string) {
  for (const [_, socket] of io.sockets.sockets) {
    const userSocket = socket as SocketWithUser;
    if (userSocket.user && userSocket.user.id === userId) {
      console.log('Found socket for:', userSocket.user.username);
      return userSocket;
    };
  }
}

server.listen(3001, () => console.log('Server running on port 3001'));
