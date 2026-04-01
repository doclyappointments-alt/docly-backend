// src/modules/admin/utils/timeRanges.ts

export type TimeRangeQuery = {
  range?: string; // '7d' | '30d' | '90d' | 'all' | undefined
  from?: string;
  to?: string;
};

export type TimeRange = {
  from: Date;
  to: Date;
};

const now = () => new Date();

export const buildTimeRange = (query: TimeRangeQuery): TimeRange => {
  const { range, from, to } = query;

  if (from && to) {
    return {
      from: new Date(from),
      to: new Date(to),
    };
  }

  const end = now();

  switch (range) {
    case '7d':
      return { from: daysAgo(7), to: end };
    case '30d':
      return { from: daysAgo(30), to: end };
    case '90d':
      return { from: daysAgo(90), to: end };
    case 'all':
      return { from: new Date(0), to: end };
    default:
      // default: last 30 days
      return { from: daysAgo(30), to: end };
  }
};

const daysAgo = (n: number): Date => {
  const d = now();
  d.setDate(d.getDate() - n);
  return d;
};
