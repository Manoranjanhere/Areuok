const express = require('express');
const { toISTISO } = require('../utils/time');
const router = express.Router();

router.post('/api/v1/checkin', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: "deviceId is required." });
    }

    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({ _id: deviceId });

    if (!user) {
      return res.status(404).json({
        error: "User not found. Please set up your emergency contacts first."
      });
    }

    const now = new Date();
    await usersCollection.updateOne(
      { _id: deviceId },
      { $set: { last_checkin_at: now, status: "SAFE" } }
    );

    return res.status(200).json({
      message: "Check-in successful. You're marked as SAFE.",
      last_checkin_at: toISTISO(now),
    });
  } catch (err) {
    console.error("Error in /api/v1/checkin:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;