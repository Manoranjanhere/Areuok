process.env.TZ = process.env.TZ || 'Asia/Kolkata';

const express = require('express');
const { MongoClient } = require('mongodb');
const cron = require('node-cron');
const twilio = require('twilio');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
require('dotenv').config();

const app = express();
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));

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
  const frequencyLabel = user.checkinFrequency || `${user.checkinFrequencyMinutes || 1440} minutes`;
  const graceLabel = user.gracePeriod || `${user.gracePeriodMinutes || 0} minutes`;
  const message =
    `Alert: ${user.user_name} has missed their ${frequencyLabel} safety check-in ` +
    `(grace period: ${graceLabel}). Please try to contact them immediately.`;

  for (const contact of user.contacts) {
    if (!contact.phone) continue;

    if (process.env.TWILIO_PHONE_NUMBER) {
      try {
        await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: contact.phone,
        });
        console.log(`SMS alert sent to ${contact.name}`);
      } catch (err) {
        console.error(`Failed to SMS ${contact.name}:`, err.message);
      }
    }

    if (process.env.TWILIO_WHATSAPP_NUMBER) {
      try {
        await twilioClient.messages.create({
          body: message,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:${contact.phone}`,
        });
        console.log(`WhatsApp alert sent to ${contact.name}`);
      } catch (err) {
        console.error(`Failed to WhatsApp ${contact.name}:`, err.message);
      }
    }
  }
}

function isCheckinExpired(user, now = Date.now()) {
  if (!user.last_checkin_at) return false;

  const frequencyMinutes = user.checkinFrequencyMinutes ?? 2880;
  const graceMinutes = user.gracePeriodMinutes ?? 0;
  const allowedMs = (frequencyMinutes + graceMinutes) * 60 * 1000;
  const elapsedMs = now - new Date(user.last_checkin_at).getTime();

  return elapsedMs > allowedMs;
}

function startCronJob(db) {
  cron.schedule('*/10 * * * *', async () => {
    console.log("Running check-in expiry check...");
    const safeUsers = await db.collection('users').find({ status: "SAFE" }).toArray();
    const now = Date.now();

    for (const user of safeUsers) {
      if (!isCheckinExpired(user, now)) continue;

      await sendAlerts(user);
      await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { status: "MISSED" } }
      );
      console.log(`Alert sent for user: ${user.user_name}`);
    }
  }, { timezone: 'Asia/Kolkata' });
}

const PORT = process.env.PORT || 3000;

connectDB().then((db) => {
  startCronJob(db);
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});