// chat-backend/routes/chat.js
import express from 'express';
import { Response } from 'express';
import type { AuthRequest } from './friend';
const router = express.Router();
const Message = require('../models/Message');
const jwt = require('jsonwebtoken');
import { NextFunction } from 'express';
import { types } from 'util';

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }
};

router.get('/history', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    const { type, id } = req.query;
    // if either is undefined, return an error
    if (!type || !id) {
        res.status(400).json({ error: 'Missing query parameters' });
        return;
    }
    if (type == 'undefined' || id == 'undefined') {
        res.status(400).json({ error: 'Missing query parameters' });
        return;
    }
    // if the type is not 'user' or 'room', return an error
    if (type !== 'user' && type !== 'room') {
        res.status(400).json({ error: 'Invalid chat type' });
        return;
    }
    // find messages based on the type and id
    let messages;
    if (!req.user) {
        res.status(401).json({ error: 'User not authenticated' });
        return;
    }
    if (type === 'user') {
        messages = await Message.find({
            $or: [
                { sender: req.user.id, recipient: id },
                { sender: id, recipient: req.user.id },
            ],
        })
            .populate('sender', 'username')
            .sort({ timestamp: 1 });
    } else if (type === 'room') {
        messages = await Message.find({ room: id })
            .populate('sender', 'username');
    } else {
        res.status(400).json({ error: 'Invalid chat type' });
        return;
    }
    res.json(messages);
});

module.exports = router;