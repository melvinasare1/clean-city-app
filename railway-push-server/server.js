// Railway Push Notification Server
// Simple Express server to send push notifications via Expo Push Service
// Deploy this to Railway as a separate service

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Start server
app.listen(PORT, () => {
  console.log(`Push notification server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

