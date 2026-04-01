// src/modules/chat/chat.service.ts
import * as ChatModel from './chat.model.js';

export const sendMessage = async (sender: 'PATIENT' | 'ADMIN', message: string) => {
  return ChatModel.createMessage({ sender, message });
};

export const fetchMessages = async () => {
  return ChatModel.getMessages();
};
