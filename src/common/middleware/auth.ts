import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prismaClient.js';
import { logger } from '../utils/logger.js';

interface JwtPayload {
  userId: number;
  role?: string;
}

/**
 * ----------------------
 * Authentication Middleware
 * ----------------------
 * Verifies JWT, fetches user, attaches userId + userRole to req.
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const [, token] = authHeader.split(' ');
  const JWT_SECRET = process.env.JWT_SECRET;

  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set!');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.userId = user.id;
    req.userRole = user.role;

    next();
  } catch (err) {
    logger.error({
      err,
      msg: 'Access token verification failed',
      path: req.originalUrl,
    });

    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
};

/**
 * ----------------------
 * Role Authorization Middleware
 * ----------------------
 */
export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.userRole || !allowedRoles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
};
