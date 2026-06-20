const express = require('express');
const router = express.Router();

router.post('/api/v1/contacts', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { deviceId, user_name, contacts } = req.body;

    if (!deviceId || !user_name || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({
        error: "deviceId, user_name, and at least one contact are required."
      });
    }

    for (const contact of contacts) {
      if (!contact.name || (!contact.phone && !contact.email)) {
        return res.status(400).json({
          error: "Each contact must have a name and at least a phone or email."
        });
      }
    }

    const usersCollection = db.collection('users');
    const existingUser = await usersCollection.findOne({ _id: deviceId });

    if (existingUser) {
      await usersCollection.updateOne(
        { _id: deviceId },
        { $set: { user_name, contacts, updated_at: new Date() } }
      );
      return res.status(200).json({ message: "Contacts updated successfully.", deviceId });
    } else {
      const newUser = {
        _id: deviceId,
        user_name,
        last_checkin_at: new Date(),
        status: "SAFE",
        contacts,
        created_at: new Date()
      };
      await usersCollection.insertOne(newUser);
      return res.status(201).json({ message: "User and contacts created successfully.", deviceId });
    }
  } catch (err) {
    console.error("Error in /api/v1/contacts:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;