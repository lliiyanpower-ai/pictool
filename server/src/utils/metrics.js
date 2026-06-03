"use strict";

const store = require("../store");

module.exports = {
  getSummary: store.getSummary,
  getTools: store.getTools,
  getEvents: store.getEvents,
  getPresets: store.getPresets,
  getFailures: store.getFailures,
  getSessions: store.getSessions,
  getSessionDetail: store.getSessionDetail,
  getDashboardMetrics: store.getDashboardMetrics
};
