// src/modules/chat/chat.controller.ts
import { Request, Response } from 'express';
import * as ChatService from './chat.service.js';

export const postMessage = async (req: Request, res: Response) => {
  try {
    const { sender, message } = req.body;
    if (!sender || !message) return res.status(400).json({ message: 'Missing sender or message' });

    const saved = await ChatService.sendMessage(sender, message);
    res.status(201).json(saved);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to send message' });
  }
};

export const getMessages = async (_req: Request, res: Response) => {
  try {
    const messages = await ChatService.fetchMessages();
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch messages' });
  }
};
