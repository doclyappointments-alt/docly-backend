import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.userRole;

    logger.debug({
      msg: 'authorizeRoles check',
      userRole,
      allowedRoles: roles,
      path: req.originalUrl,
      method: req.method,
    });

    if (!userRole) {
      logger.warn({
        msg: 'Missing userRole in authorizeRoles',
        allowedRoles: roles,
        path: req.originalUrl,
        method: req.method,
      });

      return res.status(403).json({ error: 'Forbidden: no role found' });
    }

    if (!roles.includes(userRole)) {
      logger.warn({
        msg: 'Forbidden access attempt',
        userRole,
        allowedRoles: roles,
        path: req.originalUrl,
        method: req.method,
      });

      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }

    next();
  };
};
