"use strict";

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || formatDate(date) !== value ? null : date;
}

function getDateRange(query = {}) {
  const todayStart = startOfUtcDay(new Date());
  const defaultToDate = todayStart;
  const defaultFromDate = addDays(defaultToDate, -6);

  const parsedFromDate = parseDateOnly(query.from);
  const parsedToDate = parseDateOnly(query.to);

  if ((query.from && !parsedFromDate) || (query.to && !parsedToDate)) {
    const error = new Error("invalid_date_range");
    error.statusCode = 400;
    throw error;
  }

  const fromDate = parsedFromDate || defaultFromDate;
  const toDate = parsedToDate || defaultToDate;
  const toExclusive = addDays(toDate, 1);

  if (fromDate >= toExclusive) {
    const error = new Error("invalid_date_range");
    error.statusCode = 400;
    throw error;
  }

  return {
    from: fromDate,
    to: toExclusive,
    fromLabel: formatDate(fromDate),
    toLabel: formatDate(toDate)
  };
}

module.exports = {
  getDateRange,
  formatDate
};
