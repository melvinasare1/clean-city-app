// Railway Push Notification Server
// Simple Express server to send push notifications via Expo Push Service
// Deploy this to Railway as a separate service

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const CRON_SECRET = process.env.CRON_SECRET || 'change-me-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ 
    ok: true, 
    service: 'push-notification-server',
    timestamp: new Date().toISOString()
  });
});

// Push notification endpoint
// POST /push
// Body: { to: string, title: string, body: string, data?: object }
app.post('/push', async (req, res) => {
  try {
    const { to, title, body, data } = req.body;

    // Validate required fields
    if (!to || !title || !body) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['to', 'title', 'body'],
        received: { to: !!to, title: !!title, body: !!body }
      });
    }

    // Validate that 'to' is an Expo push token
    if (!to.startsWith('ExponentPushToken[') && !to.startsWith('ExpoPushToken[')) {
      return res.status(400).json({
        error: 'Invalid Expo push token format',
        hint: 'Token should start with ExponentPushToken[ or ExpoPushToken['
      });
    }

    // Prepare notification payload
    const message = {
      to,
      sound: 'default',
      title,
      body,
      data: data || {},
    };

    // Send to Expo Push Service
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Expo Push Service error:', result);
      return res.status(response.status).json({
        error: 'Failed to send notification',
        details: result
      });
    }

    // Expo returns an array of receipts
    const receipt = Array.isArray(result.data) ? result.data[0] : result.data;

    if (receipt?.status === 'error') {
      console.error('Expo push error:', receipt);
      return res.status(400).json({
        error: 'Expo push notification error',
        details: receipt
      });
    }

    // Success
    res.json({
      success: true,
      receipt,
      message: 'Notification sent successfully'
    });

  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Batch push endpoint (optional - send to multiple tokens)
// POST /push/batch
// Body: { tokens: string[], title: string, body: string, data?: object }
app.post('/push/batch', async (req, res) => {
  try {
    const { tokens, title, body, data } = req.body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({
        error: 'tokens must be a non-empty array'
      });
    }

    if (!title || !body) {
      return res.status(400).json({
        error: 'Missing required fields: title and body'
      });
    }

    // Prepare messages array for batch send
    const messages = tokens.map(token => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: data || {},
    }));

    // Send to Expo Push Service
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Expo Push Service error:', result);
      return res.status(response.status).json({
        error: 'Failed to send notifications',
        details: result
      });
    }

    res.json({
      success: true,
      receipts: result.data,
      count: result.data?.length || 0,
      message: `Sent ${result.data?.length || 0} notification(s)`
    });

  } catch (error) {
    console.error('Error sending batch push notifications:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Middleware to verify cron secret
const verifyCronSecret = (req, res, next) => {
  const providedSecret = req.headers['x-cron-secret'];
  if (providedSecret !== CRON_SECRET) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing X-CRON-SECRET header'
    });
  }
  next();
};

// Daily reminders cron endpoint
// POST /cron/daily-reminders
// Headers: X-CRON-SECRET: <your-secret>
// 
// This endpoint reads all users with dailyEnabled=true and matching current time,
// then sends push notifications using their stored Expo push tokens.
// 
// NOTE: This requires Firebase Admin SDK. Install it:
//   npm install firebase-admin
// 
// Set GOOGLE_APPLICATION_CREDENTIALS environment variable to your service account JSON path,
// or set FIREBASE_SERVICE_ACCOUNT_JSON as a JSON string.
app.post('/cron/daily-reminders', verifyCronSecret, async (req, res) => {
  try {
    // Check if Firebase Admin is available
    let admin;
    let firestore;
    
    try {
      admin = require('firebase-admin');
      
      // Initialize if not already initialized
      if (!admin.apps.length) {
        // Try to use service account from environment
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
        } else {
          // Fall back to application default credentials
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
          });
        }
      }
      
      firestore = admin.firestore();
    } catch (error) {
      return res.status(500).json({
        error: 'Firebase Admin not configured',
        message: 'Install firebase-admin and configure credentials. See README for details.',
        details: error.message
      });
    }

    // Get current time
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    console.log(`Checking for daily reminders at ${currentHour}:${currentMinute}`);

    // Query Firestore for users with reminders enabled at this time
    const profilesRef = firestore.collection('profiles');
    const snapshot = await profilesRef
      .where('reminders.dailyEnabled', '==', true)
      .where('reminders.hour', '==', currentHour)
      .where('reminders.minute', '==', currentMinute)
      .get();

    if (snapshot.empty) {
      return res.json({
        success: true,
        message: 'No users found with reminders at this time',
        count: 0,
        time: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`
      });
    }

    // Collect valid push tokens
    const messages = [];
    const results = {
      sent: 0,
      failed: 0,
      noToken: 0,
      errors: []
    };

    snapshot.forEach((doc) => {
      const data = doc.data();
      const pushToken = data.expoPushToken;
      const reminders = data.reminders || {};

      if (!pushToken) {
        results.noToken++;
        return;
      }

      // Validate token format
      if (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken[')) {
        results.errors.push(`Invalid token format for user ${doc.id}`);
        return;
      }

      messages.push({
        to: pushToken,
        sound: 'default',
        title: 'Daily Reminder',
        body: 'Don\'t forget to check your bookings today!',
        data: {
          type: 'daily_reminder',
        },
      });
    });

    if (messages.length === 0) {
      return res.json({
        success: true,
        message: 'No valid push tokens found',
        count: 0,
        stats: results
      });
    }

    // Send batch notification via Expo Push Service
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Expo Push Service error:', result);
      return res.status(response.status).json({
        error: 'Failed to send notifications',
        details: result,
        stats: results
      });
    }

    // Count successes and failures
    if (Array.isArray(result.data)) {
      result.data.forEach((receipt) => {
        if (receipt.status === 'ok') {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(receipt.message || 'Unknown error');
        }
      });
    }

    res.json({
      success: true,
      message: `Processed ${messages.length} reminder(s)`,
      count: messages.length,
      stats: results,
      time: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`
    });

  } catch (error) {
    console.error('Error processing daily reminders:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Weekly reminders cron endpoint
// POST /cron/weekly-reminders
// Headers: X-CRON-SECRET: <your-secret>
// 
// This endpoint reads all users with weeklyEnabled=true and matching current weekday/time,
// then sends push notifications using their stored Expo push tokens.
// 
// Weekday mapping: 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
// 
// NOTE: This requires Firebase Admin SDK. Install it:
//   npm install firebase-admin
// 
// Set GOOGLE_APPLICATION_CREDENTIALS environment variable to your service account JSON path,
// or set FIREBASE_SERVICE_ACCOUNT_JSON as a JSON string.
app.post('/cron/weekly-reminders', verifyCronSecret, async (req, res) => {
  try {
    // Check if Firebase Admin is available
    let admin;
    let firestore;
    
    try {
      admin = require('firebase-admin');
      
      // Initialize if not already initialized
      if (!admin.apps.length) {
        // Try to use service account from environment
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
          const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
        } else {
          // Fall back to application default credentials
          admin.initializeApp({
            credential: admin.credential.applicationDefault(),
          });
        }
      }
      
      firestore = admin.firestore();
    } catch (error) {
      return res.status(500).json({
        error: 'Firebase Admin not configured',
        message: 'Install firebase-admin and configure credentials. See README for details.',
        details: error.message
      });
    }

    // Get current time and weekday
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    // JavaScript getDay(): 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    // Convert to our format: 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
    const jsDay = now.getDay();
    const currentWeekday = jsDay === 0 ? 7 : jsDay; // Sunday: 0 -> 7, Mon-Sat: 1-6 -> 1-6

    console.log(`Checking for weekly reminders on ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][jsDay]} at ${currentHour}:${currentMinute}`);

    // Query Firestore for users with weekly reminders enabled at this weekday and time
    const profilesRef = firestore.collection('profiles');
    const snapshot = await profilesRef
      .where('weeklyReminders.weeklyEnabled', '==', true)
      .where('weeklyReminders.weekday', '==', currentWeekday)
      .where('weeklyReminders.hour', '==', currentHour)
      .where('weeklyReminders.minute', '==', currentMinute)
      .get();

    if (snapshot.empty) {
      return res.json({
        success: true,
        message: 'No users found with weekly reminders at this weekday/time',
        count: 0,
        weekday: currentWeekday,
        time: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`
      });
    }

    // Collect valid push tokens
    const messages = [];
    const results = {
      sent: 0,
      failed: 0,
      noToken: 0,
      errors: []
    };

    snapshot.forEach((doc) => {
      const data = doc.data();
      const pushToken = data.expoPushToken;
      const weeklyReminders = data.weeklyReminders || {};

      if (!pushToken) {
        results.noToken++;
        return;
      }

      // Validate token format
      if (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken[')) {
        results.errors.push(`Invalid token format for user ${doc.id}`);
        return;
      }

      messages.push({
        to: pushToken,
        sound: 'default',
        title: 'Rubbish collection reminder',
        body: 'Time to book your rubbish collection for this week.',
        data: {
          type: 'weekly_rubbish_reminder',
        },
      });
    });

    if (messages.length === 0) {
      return res.json({
        success: true,
        message: 'No valid push tokens found',
        count: 0,
        stats: results
      });
    }

    // Send batch notification via Expo Push Service
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Expo Push Service error:', result);
      return res.status(response.status).json({
        error: 'Failed to send notifications',
        details: result,
        stats: results
      });
    }

    // Count successes and failures
    if (Array.isArray(result.data)) {
      result.data.forEach((receipt) => {
        if (receipt.status === 'ok') {
          results.sent++;
        } else {
          results.failed++;
          results.errors.push(receipt.message || 'Unknown error');
        }
      });
    }

    res.json({
      success: true,
      message: `Processed ${messages.length} weekly reminder(s)`,
      count: messages.length,
      stats: results,
      weekday: currentWeekday,
      time: `${currentHour}:${currentMinute.toString().padStart(2, '0')}`
    });

  } catch (error) {
    console.error('Error processing weekly reminders:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Push notification server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  if (CRON_SECRET === 'change-me-in-production') {
    console.warn('⚠️  WARNING: CRON_SECRET is using default value. Set CRON_SECRET environment variable in production!');
  }
});

