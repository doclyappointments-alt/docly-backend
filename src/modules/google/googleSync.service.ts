/* -------------------------------------------------------
 * Google Calendar Sync Service (ESM-safe)
 * -------------------------------------------------------
 *
 * ⚠️ IMPORTANT ARCHITECTURAL NOTE
 *
 * This service intentionally uses lazy (dynamic) imports
 * instead of static imports.
 *
 * Reason:
 * - During rebuild + test execution, static imports caused
 *   premature module evaluation (Prisma, logger, Google client)
 *   leading to crashes in certain test / cron / worker contexts.
 * - Lazy imports defer dependency resolution until execution time,
 *   making this service robust across:
 *     • test runners
 *     • cron jobs
 *     • partial mocks
 *     • ESM edge cases
 *
 * This is a *situational implementation choice*, not a design
 * preference. Once the test harness and execution contexts
 * are fully stabilised, this file MAY be safely reverted to
 * static imports.
 *
 * Do not refactor without validating all Phase tests.
 * ----------------------------------------------------- */

/* -----------------------
   Lazy dependencies
------------------------ */

async function getPrisma() {
  const mod = await import("../../common/utils/prismaClient.js");
  return mod.default;
}

async function getLogger() {
  const mod = await import("../../common/utils/logger.js");
  return mod.logger.child({ module: "googleSyncService" });
}

async function getGoogleClient() {
  return await import("../../common/utils/googleClient.js");
}

/* -------------------------------------------------------
 * PUBLIC ENTRY — PER PROVIDER
 * ----------------------------------------------------- */

export async function syncProviderGoogleEvents(
  providerId: number
): Promise<any[]> {
  const prisma = await getPrisma();
  const log = await getLogger();
  const {
    getGoogleOAuthClient,
    getGoogleCalendarClient,
    refreshGoogleAccessToken,
    isGoogleAuthError,
  } = await getGoogleClient();

  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: {
      id: true,
      userId: true,
      googleAccessToken: true,
      googleRefreshToken: true,
      tokenExpiry: true,
    },
  });

  if (!provider) return [];

  if (!provider.googleAccessToken || !provider.googleRefreshToken) {
    log.info({ providerId }, "Skipping Google sync — no tokens");
    return [];
  }

  const safeProvider = {
    id: provider.id,
    userId: provider.userId,
    googleAccessToken: provider.googleAccessToken,
    googleRefreshToken: provider.googleRefreshToken,
    tokenExpiry: provider.tokenExpiry,
  };

  try {
    return await performSync(safeProvider, false);
  } catch (err) {
    if (!isGoogleAuthError(err)) throw err;

    log.warn({ providerId }, "Auth error — refreshing token and retrying once");
    return await refreshRetryOrDisable(safeProvider);
  }

  /* -------------------------------------------------------
   * REFRESH + SINGLE RETRY
   * ----------------------------------------------------- */

  async function refreshRetryOrDisable(
    provider: typeof safeProvider
  ): Promise<any[]> {
    try {
      const refreshed = await refreshGoogleAccessToken(
        provider.googleRefreshToken
      );

      await prisma.provider.update({
        where: { id: provider.id },
        data: {
          googleAccessToken: refreshed.accessToken,
          tokenExpiry: refreshed.expiryDate,
        },
      });

      return await performSync(
        {
          ...provider,
          googleAccessToken: refreshed.accessToken,
          tokenExpiry: refreshed.expiryDate,
        },
        true
      );
    } catch {
      await prisma.provider.update({
        where: { id: provider.id },
        data: {
          googleAccessToken: null,
          googleRefreshToken: null,
          tokenExpiry: null,
        },
      });

      log.warn({ providerId }, "Google sync disabled after refresh failure");
      return [];
    }
  }

  /* -------------------------------------------------------
   * ACTUAL SYNC LOGIC
   * ----------------------------------------------------- */

  async function performSync(
    provider: typeof safeProvider,
    isRetry: boolean
  ): Promise<any[]> {
    const oauthClient = getGoogleOAuthClient({
      providerId: provider.id,
      accessToken: provider.googleAccessToken,
      refreshToken: provider.googleRefreshToken,
      tokenExpiry: provider.tokenExpiry,
    });

    const calendar = getGoogleCalendarClient(oauthClient);

    let res;
    try {
      res = await calendar.events.list({
        calendarId: "primary",
        singleEvents: true,
        orderBy: "startTime",
      });
    } catch (err: any) {
      if (err?.response?.status === 429) {
        res = await calendar.events.list({
          calendarId: "primary",
          singleEvents: true,
          orderBy: "startTime",
        });
      } else {
        throw err;
      }
    }
    const events = res.data.items ?? [];

    // 🔒 HARD GUARD — prevents test / mock crashes
    if (!Array.isArray(events)) {
      log.warn(
        { eventsType: typeof events },
        "Google sync skipped — events not iterable"
      );
      return [];
    }

    for (const e of events) {
      await prisma.googleEvent.upsert({
        where: {
          eventId_providerId: {
            eventId: e.id!,
            providerId: provider.id,
          },
        },
        update: {
          summary: e.summary ?? "",
          description: e.description ?? null,
          startTime: e.start?.dateTime ? new Date(e.start.dateTime) : null,
          endTime: e.end?.dateTime ? new Date(e.end.dateTime) : null,
          status: e.status ?? null,
          updatedAt: e.updated ? new Date(e.updated) : new Date(),
        },
        create: {
          eventId: e.id!,
          providerId: provider.id,
          userId: provider.userId,
          summary: e.summary ?? "",
          description: e.description ?? null,
          startTime: e.start?.dateTime ? new Date(e.start.dateTime) : null,
          endTime: e.end?.dateTime ? new Date(e.end.dateTime) : null,
          status: e.status ?? null,
          updatedAt: e.updated ? new Date(e.updated) : new Date(),
        },
      });
    }

    log.info(
      { providerId: provider.id, count: events.length, retry: isRetry },
      "Google sync complete"
    );

    return events;
  }
}

/* -------------------------------------------------------
 * GLOBAL SYNC
 * ----------------------------------------------------- */

export async function syncAllProvidersGoogleEvents() {
  const prisma = await getPrisma();
  const log = await getLogger();

  const providers = await prisma.provider.findMany({
    where: {
      googleAccessToken: { not: null },
      googleRefreshToken: { not: null },
    },
    select: { id: true },
  });

  for (const { id } of providers) {
    try {
      await syncProviderGoogleEvents(id);
    } catch (err) {
      log.error({ providerId: id, err }, "Provider sync failed");
    }
  }
}
