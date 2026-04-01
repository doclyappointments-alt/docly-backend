import "dayjs";

declare module "dayjs" {
  interface Dayjs {
    /**
     * Convert this Dayjs instance to a specific timezone
     */
    tz(timezone?: string, keepLocalTime?: boolean): Dayjs;
  }

  interface DayjsStatic {
    /**
     * Namespace added by the timezone plugin
     */
    tz: {
      /**
       * Guess the user's local timezone
       */
      guess(): string;

      /**
       * Set a default timezone globally
       */
      setDefault(timezone: string): void;
    };
  }
}
