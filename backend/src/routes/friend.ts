// chat-backend/routes/friends.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from 'jsonwebtoken';
const Message = require('../models/Message');

export interface AuthRequest extends Request {
    user?: JwtPayload;
}

const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};

interface SearchRequestQuery {
    q: string;
}

router.get('/search', authMiddleware, async (req: AuthRequest, res: Response) => {
    const { q } = req.query as unknown as SearchRequestQuery;
    if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    // Find users whose username matches the query string if the query string is not empty
    const users = await User.find({
        username: { $regex: q, $options: 'i' },
        _id: { $ne: req.user.id },
    }).select('username');
    res.json(users);
});

router.post('/send', authMiddleware, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    const { to } = req.body;
    const from = req.user.id;
    const user = await User.findById(to);
    if (!user) {
        return res.status(400).json({ error: 'No such user' });
    }
    if (user.friends.includes(from)) {
        return res.status(400).json({ error: 'Already friends' });
    }
    if (user.pendingRequests.includes(from)) {
        return res.status(400).json({ error: 'Request already sent' });
    }
    user.pendingRequests.push(from);
    await user.save();
    // Send a notification to the recipient
    res.status(200).json({ message: 'Friend request sent' });
});

router.post('/accept', authMiddleware, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    const { requestId } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) {
        return res.status(400).json({ error: 'User not found' });
    }
    if (!user.pendingRequests.includes(requestId)) {
        return res.status(400).json({ error: 'No such request' });
    }

    // Remove the accepted request from pendingRequests
    user.pendingRequests = user.pendingRequests.filter((id: any) => id.toString() !== requestId);
    
    // Add friend if not already added
    if (!user.friends.includes(requestId)) {
        user.friends.push(requestId);
    }
    
    await user.save();

    const requester = await User.findById(requestId);
    if (!requester) {
        return res.status(400).json({ error: 'Requester not found' });
    }
    
    // If a mutual friend request exists, remove it to avoid duplicates
    requester.pendingRequests = requester.pendingRequests.filter((id: any) => id.toString() !== req.user!.id);
    
    if (!requester.friends.includes(req.user.id)) {
        requester.friends.push(req.user.id);
    }
    
    await requester.save();

    res.status(200).json({ message: 'Friend request accepted' });
});

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    const user = await User.findById(req.user.id).populate('friends', 'username online');
    if (!user) {
        return res.status(400).json({ error: 'User not found' });
    }
    const friends = await user.friends.map(async (friend: any) => ({
        id: friend._id,
        username: friend.username,
        online: friend.online,
        lastMessage: await Message.findOne({
            $or: [
                { sender: req.user!.id, recipient: friend._id },
                { sender: friend._id, recipient: req.user!.id },
            ],
        }).sort({ timestamp: -1 }).limit(1),
    }));
    const populatedFriends = await Promise.all(friends);
    res.json(populatedFriends);
});

router.get('/requests', authMiddleware, async (req: AuthRequest, res: Response) => {
    if (!req.user) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    const user = await User.findById(req.user.id).populate('pendingRequests', 'username');
    res.json(user.pendingRequests);
});

module.exports = router;