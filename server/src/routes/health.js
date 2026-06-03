"use strict";

const express = require("express");
const { checkConnection, getStoreType } = require("../store");

const router = express.Router();

router.get("/", async (req, res) => {
  const dbOk = await checkConnection();
  res.status(dbOk ? 200 : 500).json({
    ok: dbOk,
    service: "pictool-analytics",
    db: dbOk,
    store: getStoreType()
  });
});

module.exports = router;
