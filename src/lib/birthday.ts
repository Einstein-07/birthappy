export const SITE_TIME_ZONE = "Asia/Shanghai";

const WEEKDAYS = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六"
] as const;

const MONTHS_ZH = [
  "一月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "十一月",
  "十二月"
] as const;

const MONTHS_EN = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC"
] as const;

export type Today = {
  iso: string;
  year: number;
  month: number;
  day: number;
  monthDay: string;
  monthZh: string;
  monthEn: string;
  weekday: string;
  isLeapYear: boolean;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getToday(now: Date = new Date()): Today {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
  const parts = formatter.formatToParts(now);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = part.value;
  }

  const year = Number(lookup.year);
  const month = Number(lookup.month);
  const day = Number(lookup.day);
  const weekdayMap: Record<string, string> = {
    Sun: "星期日",
    Mon: "星期一",
    Tue: "星期二",
    Wed: "星期三",
    Thu: "星期四",
    Fri: "星期五",
    Sat: "星期六"
  };

  return {
    iso: `${year}-${pad(month)}-${pad(day)}`,
    year,
    month,
    day,
    monthDay: `${pad(month)}-${pad(day)}`,
    monthZh: MONTHS_ZH[month - 1],
    monthEn: MONTHS_EN[month - 1],
    weekday: weekdayMap[lookup.weekday] ?? WEEKDAYS[new Date(now).getDay()],
    isLeapYear: isLeapYear(year)
  };
}

export function getYear(now: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric"
  });
  return Number(formatter.format(now));
}

export function getMonthKey(now: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit"
  });
  const parts = formatter.formatToParts(now);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = part.value;
  }
  return `${lookup.year}-${lookup.month}`;
}

export function isValidBirthday(value: string, today = getToday()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || year > today.year) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return false;
  }

  return value <= today.iso;
}

export function isBirthdayToday(birthday: string, today = getToday()) {
  const monthDay = birthday.slice(5, 10);
  if (monthDay === today.monthDay) return true;

  // 2 月 29 日出生的人，在非闰年的 2 月 28 日一起庆祝。
  return (
    today.monthDay === "02-28" &&
    monthDay === "02-29" &&
    !today.isLeapYear
  );
}

export function formatBirthdayShort(birthday: string) {
  const month = Number(birthday.slice(5, 7));
  const day = Number(birthday.slice(8, 10));
  if (!month || !day) return birthday;
  return `${month} 月 ${day} 日`;
}

export function formatBirthdayFull(birthday: string) {
  const year = Number(birthday.slice(0, 4));
  const month = Number(birthday.slice(5, 7));
  const day = Number(birthday.slice(8, 10));
  if (!year || !month || !day) return birthday;
  return `${year} 年 ${month} 月 ${day} 日`;
}

export function formatTodayLong(today = getToday()) {
  return `${today.year} 年 ${today.month} 月 ${today.day} 日 · ${today.weekday}`;
}
