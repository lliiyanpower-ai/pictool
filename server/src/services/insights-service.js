"use strict";

const store = require("../store");
const { getInsightMetrics } = require("./metrics-service");
const { generateInsightRules } = require("../utils/insight-rules");

async function listInsights(range) {
  return store.getInsights(range);
}

async function generateInsights(range) {
  const metrics = await getInsightMetrics(range);
  const insights = generateInsightRules(metrics);
  const saved = await store.saveInsights(range, insights);
  return {
    ok: true,
    count: saved.length,
    insights: saved
  };
}

module.exports = {
  listInsights,
  generateInsights
};
