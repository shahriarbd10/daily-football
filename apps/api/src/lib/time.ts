import { env } from "../config/env.js";

export const BD_TIMEZONE = env.bdTimezone;

export const todayInDhaka = () => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BD_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return formatter.format(new Date());
};

export const formatDhakaTime = (date: string | Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: BD_TIMEZONE,
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(new Date(date));

export const getDhakaUtcRange = (date: string) => {
  const start = new Date(`${date}T00:00:00+06:00`);
  const end = new Date(`${date}T23:59:59.999+06:00`);

  return { start, end };
};

export const getProviderDateWindow = (date: string) => {
  const start = new Date(`${date}T00:00:00+06:00`);
  const end = new Date(`${date}T23:59:59.999+06:00`);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  return {
    dateFrom: formatter.format(start),
    dateTo: formatter.format(end)
  };
};
