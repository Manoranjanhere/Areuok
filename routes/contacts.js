const express = require('express');
const router = express.Router();

const DEFAULT_CHECKIN_FREQUENCY_MINUTES = 1440;
const DEFAULT_GRACE_PERIOD_MINUTES = 30;

function buildUserSettings(body) {
  const {
    user_name,
    contacts,
    checkinFrequency,
    checkinFrequencyMinutes,
    gracePeriod,
    gracePeriodMinutes,
  } = body;

  const frequencyMinutes = Number(checkinFrequencyMinutes ?? DEFAULT_CHECKIN_FREQUENCY_MINUTES);
  const graceMinutes = Number(gracePeriodMinutes ?? DEFAULT_GRACE_PERIOD_MINUTES);

  return {
    user_name,
    contacts,
    checkinFrequency: checkinFrequency || `Every ${frequencyMinutes} minutes`,
    checkinFrequencyMinutes: frequencyMinutes,
    gracePeriod: gracePeriod || `${graceMinutes} minutes`,
    gracePeriodMinutes: graceMinutes,
    updated_at: new Date(),
  };
}

function validateContactsRequest(body) {
  const { deviceId, user_name, contacts, checkinFrequencyMinutes, gracePeriodMinutes } = body;

  if (!deviceId || !user_name || !Array.isArray(contacts) || contacts.length === 0) {
    return "deviceId, user_name, and at least one contact are required.";
  }

  if (checkinFrequencyMinutes !== undefined) {
    const frequency = Number(checkinFrequencyMinutes);
    if (!Number.isFinite(frequency) || frequency <= 0) {
      return "checkinFrequencyMinutes must be a positive number.";
    }
  }

  if (gracePeriodMinutes !== undefined) {
    const grace = Number(gracePeriodMinutes);
    if (!Number.isFinite(grace) || grace < 0) {
      return "gracePeriodMinutes must be a non-negative number.";
    }
  }

  for (const contact of contacts) {
    if (!contact.name || !contact.phone) {
      return "Each contact must have a name and phone number.";
    }
  }

  return null;
}

router.post('/api/v1/contacts', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { deviceId } = req.body;

    const validationError = validateContactsRequest(req.body);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const userSettings = buildUserSettings(req.body);
    const usersCollection = db.collection('users');
    const existingUser = await usersCollection.findOne({ _id: deviceId });

    if (existingUser) {
      await usersCollection.updateOne({ _id: deviceId }, { $set: userSettings });
      return res.status(200).json({
        message: "Contacts updated successfully.",
        deviceId,
        checkinFrequency: userSettings.checkinFrequency,
        checkinFrequencyMinutes: userSettings.checkinFrequencyMinutes,
        gracePeriod: userSettings.gracePeriod,
        gracePeriodMinutes: userSettings.gracePeriodMinutes,
      });
    }

    const newUser = {
      _id: deviceId,
      ...userSettings,
      last_checkin_at: new Date(),
      status: "SAFE",
      created_at: new Date(),
    };
    await usersCollection.insertOne(newUser);
    return res.status(201).json({
      message: "User and contacts created successfully.",
      deviceId,
      checkinFrequency: userSettings.checkinFrequency,
      checkinFrequencyMinutes: userSettings.checkinFrequencyMinutes,
      gracePeriod: userSettings.gracePeriod,
      gracePeriodMinutes: userSettings.gracePeriodMinutes,
    });
  } catch (err) {
    console.error("Error in /api/v1/contacts:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
