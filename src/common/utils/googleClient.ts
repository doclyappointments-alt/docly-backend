// src/common/utils/googleClient.ts

import { google } from 'googleapis';
import prisma from './prismaClient.js';
import { logger } from './logger.js';
import { getGoogleConfig } from './googleConfig.js';

const log = logger.child({ module: 'googleClient' });

interface OAuthContext {
  providerId: number;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: Date | null;
}

/* -------------------------------------------------------
 * OAUTH CLIENT (AUTO-REFRESH ENABLED)
 * ----------------------------------------------------- */
export function getGoogleOAuthClient(ctx: OAuthContext) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    getGoogleConfig();

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );

  oauth2Client.setCredentials({
    access_token: ctx.accessToken ?? undefined,
    refresh_token: ctx.refreshToken ?? undefined,
    expiry_date: ctx.tokenExpiry?.getTime(),
  });

  // Persist refreshed tokens automatically
  oauth2Client.on('tokens', async (tokens) => {
    try {
      await prisma.provider.update({
        where: { id: ctx.providerId },
        data: {
          googleAccessToken: tokens.access_token ?? ctx.accessToken,
          googleRefreshToken: tokens.refresh_token ?? ctx.refreshToken,
          tokenExpiry: tokens.expiry_date
            ? new Date(tokens.expiry_date)
            : ctx.tokenExpiry,
        },
      });

      log.info({ providerId: ctx.providerId }, 'Google tokens refreshed & saved');
    } catch (err) {
      log.error({ providerId: ctx.providerId, err }, 'Failed saving refreshed tokens');
    }
  });

  return oauth2Client;
}

/* -------------------------------------------------------
 * MANUAL REFRESH (CONTROLLED RETRY PATH)
 * ----------------------------------------------------- */
export async function refreshGoogleAccessToken(refreshToken: string) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    getGoogleConfig();

  const client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );

  client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await client.refreshAccessToken();

  if (!credentials?.access_token) {
    throw new Error('Google refresh returned no access token');
  }

  return {
    accessToken: credentials.access_token,
    expiryDate: credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : null,
  };
}

/* -------------------------------------------------------
 * ERROR CLASSIFICATION
 * ----------------------------------------------------- */
export function isGoogleAuthError(err: any): boolean {
  const status = err?.code ?? err?.response?.status;
  const msg = String(
    err?.message ??
      err?.response?.data?.error_description ??
      err?.response?.data?.error ??
      '',
  );

  if (status === 401 || status === 403) return true;
  if (/invalid_grant/i.test(msg)) return true;
  if (/invalid_credentials/i.test(msg)) return true;

  return false;
}

/* -------------------------------------------------------
 * CALENDAR CLIENT
 * ----------------------------------------------------- */
export function getGoogleCalendarClient(oAuth2Client: any) {
  return google.calendar({ version: 'v3', auth: oAuth2Client });
}
