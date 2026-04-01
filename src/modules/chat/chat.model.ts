// src/modules/chat/chat.model.ts
import prisma from "@common/utils/prismaClient.js";

export interface ChatMessage {
  id?: number;
  sender: 'PATIENT' | 'ADMIN';
  message: string;
  createdAt?: Date;
}

export const createMessage = async (data: ChatMessage) => {
  return prisma.chatMessage.create({ data });
};

export const getMessages = async () => {
  return prisma.chatMessage.findMany({ orderBy: { createdAt: 'asc' } });
};
