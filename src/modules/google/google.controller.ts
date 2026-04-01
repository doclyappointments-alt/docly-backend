// src/modules/google/google.controller.ts

import type { Request, Response } from 'express';
import { google } from 'googleapis';

import prisma from '../../common/utils/prismaClient.js';
import { logger } from '../../common/utils/logger.js';
import { getGoogleConfig } from '../../common/utils/googleConfig.js';
import { syncProviderGoogleEvents } from './googleSync.service.js';

const log = logger.child({ controller: 'google' });

/**
 * Helper to create a fresh OAuth2 client when needed
 */
const createOAuthClient = () => {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  } = getGoogleConfig();

  return new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
};

// -----------------------
// Connect Google Calendar
// -----------------------
export const connectGoogleCalendar = async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      log.info({ msg: 'Google connect failed - missing userId' });
      return res.status(400).json({ error: 'Missing userId' });
    }

    const oauth2Client = createOAuthClient();

    // Read-only mirror mode for now
    const scopes = ['https://www.googleapis.com/auth/calendar.readonly'];

    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: userId,
    });

    log.info({ msg: 'Google OAuth URL generated', userId });
    res.redirect(url);
  } catch (e: unknown) {
    log.error({ err: e, route: '/google/connectCalendar' });
    res.status(500).json({
      error: 'Failed to generate Google OAuth URL',
      details: String(e),
    });
  }
};

// -----------------------
// Handle OAuth Callback
// -----------------------
export const handleGoogleOAuthCallback = async (
  req: Request,
  res: Response,
) => {
  try {
    const code = req.query.code as string;
    const stateStr = req.query.state as string;

    if (!code || !stateStr) {
      log.info({
        msg: 'Google OAuth callback failed - missing code or state',
      });
      return res.status(400).json({ error: 'Missing code or userId' });
    }

    const userId = Number(stateStr);

    if (isNaN(userId)) {
      log.info({
        msg: 'Google OAuth callback failed - invalid userId',
        stateStr,
      });
      return res.status(400).json({ error: 'Invalid userId' });
    }

    const oauth2Client = createOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      log.info({
        msg: 'Google OAuth callback failed - user not found',
        userId,
      });
      return res.status(400).json({ error: 'User not found' });
    }

    await prisma.provider.upsert({
      where: { userId },
      update: {
        googleAccessToken: tokens.access_token ?? null,
        googleRefreshToken: tokens.refresh_token ?? null,
        tokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
      },
      create: {
        userId,
        displayName: user.name ?? 'New Provider',
        specialty: 'Unspecified',
        bio: '',
        latitude: 0,
        longitude: 0,
        googleAccessToken: tokens.access_token ?? null,
        googleRefreshToken: tokens.refresh_token ?? null,
        tokenExpiry: tokens.expiry_date
          ? new Date(tokens.expiry_date)
          : null,
      },
    });

    log.info({ msg: 'Google Calendar connected', userId });
    res.json({ message: 'Google Calendar connected successfully' });
  } catch (e: unknown) {
    log.error({ err: e, route: '/google/oauthCallback' });
    res.status(500).json({
      error: 'Failed to handle Google OAuth callback',
      details: String(e),
    });
  }
};

// -----------------------
// Manual Sync Endpoint
// -----------------------
export const syncGoogleCalendarEvents = async (
  req: Request,
  res: Response,
) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const provider = await prisma.provider.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!provider) {
      return res
        .status(400)
        .json({ error: 'Provider not found for this user' });
    }

    // Returns array of synced events
    const events = await syncProviderGoogleEvents(provider.id);

    return res.json({
      message: 'Google Calendar synced successfully',
      eventCount: events.length, // REQUIRED BY TESTS
      events,
    });
  } catch (err) {
    log.error({ err, route: '/google/sync' });
    return res.status(500).json({
      error: 'Failed to sync Google Calendar',
      details: String(err),
    });
  }
};

