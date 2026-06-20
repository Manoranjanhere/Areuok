const express = require('express');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');
const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');
require('dotenv').config();

const app = express();
app.use(express.json());

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);

async function connectDB() {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db('areyoudead');
  app.locals.db = db;
  console.log("MongoDB connected");
  return db;
}

// Routes
const contactsRoute = require('./routes/contacts');
const checkinRoute = require('./routes/checkin');
app.use(contactsRoute);
app.use(checkinRoute);

// Health check route (useful to confirm server is alive)
app.get('/', (req, res) => {
  res.send('Are You Dead API is running.');
});

async function sendAlerts(user) {
  for (const contact of user.contacts) {
    // Send SMS if phone exists
    if (contact.phone) {
      try {
        await twilioClient.messages.create({
          body: `Alert: ${user.user_name} has missed their 48-hour safety check-in. Please try to contact them immediately.`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: contact.phone
        });
      } catch (err) {
        console.error(`Failed to SMS ${contact.name}:`, err.message);
      }
    }

    // Send Email if email exists
    if (contact.email) {
      try {
        await sgMail.send({
          to: contact.email,
          from: process.env.SENDGRID_FROM_EMAIL,
          subject: `Safety Alert: ${user.user_name}`,
          text: `${user.user_name} has missed their 48-hour safety check-in. Please try to contact them immediately.`
        });
      } catch (err) {
        console.error(`Failed to email ${contact.name}:`, err.message);
      }
    }
  }
}

function startCronJob(db) {
  cron.schedule('*/10 * * * *', async () => {
    console.log("Running check-in expiry check...");
    const expiredUsers = await db.collection('users').find({
      last_checkin_at: { $lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      status: "SAFE"
    }).toArray();

    for (const user of expiredUsers) {
      await sendAlerts(user);
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { status: "MISSED" } }
      );
      console.log(`Alert sent for user: ${user.user_name}`);
    }
  });
}

const PORT = process.env.PORT || 3000;

connectDB().then((db) => {
  startCronJob(db);
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});