import { google } from "googleapis";

let originalGetToken: any | null = null;
let originalCalendar: any | null = null;

export function mockGoogleOAuth(tokens: {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}) {
  const OAuth2: any = (google as any).auth.OAuth2;

  if (!originalGetToken) {
    originalGetToken = OAuth2.prototype.getToken;
  }

  OAuth2.prototype.getToken = async () => {
    return { tokens };
  };
}

type CalendarItems =
  | any[]
  | (() => any[] | Promise<any[]>);

let currentEvents: CalendarItems = [];

export function mockGoogleCalendar(eventsOrFn: CalendarItems) {
  currentEvents = eventsOrFn;

  if (!originalCalendar) {
    originalCalendar = (google as any).calendar;
  }

  (google as any).calendar = () => ({
    events: {
      list: async () => {
        const items =
          typeof currentEvents === "function"
            ? await currentEvents()
            : currentEvents;

        return {
          data: {
            items,
          },
        };
      },
    },
  });
}

export function restoreGoogleMocks() {
  const OAuth2: any = (google as any).auth.OAuth2;

  if (originalGetToken) {
    OAuth2.prototype.getToken = originalGetToken;
    originalGetToken = null;
  }

  if (originalCalendar) {
    (google as any).calendar = originalCalendar;
    originalCalendar = null;
  }

  currentEvents = [];
}
