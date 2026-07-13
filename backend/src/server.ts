import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';
import { setupSignaling } from './socket/signaling';
import Room from './models/Room';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Configure CORS
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST'],
  credentials: true,
}));

app.use(express.json());

// Database connection
connectDB();

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setupSignaling(io);

// Rest API Routes
// 1. Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// 2. Create or verify a room
app.post('/api/rooms', async (req, res) => {
  try {
    const { roomId } = req.body;
    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    let room = await Room.findOne({ roomId });

    if (!room) {
      room = new Room({
        roomId,
        status: 'active',
        doctorJoined: false,
        patientJoined: false,
      });
      await room.save();
      return res.status(201).json({ message: 'Room created successfully', room });
    }

    // If room exists but ended, reactivate it
    if (room.status === 'ended') {
      room.status = 'active';
      room.doctorJoined = false;
      room.patientJoined = false;
      room.endedAt = undefined;
      await room.save();
    }

    return res.status(200).json({ message: 'Room retrieved/reactivated', room });
  } catch (error) {
    console.error('Error creating/retrieving room:', error);
    return res.status(500).json({ error: 'Server error creating or retrieving room' });
  }
});

// 3. Get room details
app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    return res.status(200).json(room);
  } catch (error) {
    console.error('Error getting room details:', error);
    return res.status(500).json({ error: 'Server error getting room details' });
  }
});

// 4. Get WebRTC configuration (including TURN servers)
app.get('/api/webrtc-config', async (req, res) => {
  try {
    const turnTokenId = process.env.TURN_TOKEN_ID;
    const turnApiToken = process.env.TURN_API_TOKEN;

    const defaultIceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ];

    if (!turnTokenId || !turnApiToken) {
      console.log('TURN credentials not configured, returning default STUN servers.');
      return res.status(200).json({ iceServers: defaultIceServers });
    }

    const cfUrl = `https://rtc.live.cloudflare.com/v1/turn/keys/${turnTokenId}/credentials/generate-ice-servers`;
    console.log(`Fetching TURN credentials from Cloudflare: ${cfUrl}`);
    const response = await fetch(cfUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${turnApiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl: 86400 }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch Cloudflare TURN credentials: ${response.status} ${response.statusText} - ${errorText}`);
      return res.status(200).json({ iceServers: defaultIceServers });
    }

    const data = await response.json() as any;
    console.log('Successfully retrieved Cloudflare TURN credentials');
    
    if (data && Array.isArray(data.iceServers)) {
      return res.status(200).json({ iceServers: data.iceServers });
    }

    return res.status(200).json({ iceServers: defaultIceServers });
  } catch (error) {
    console.error('Error requesting Cloudflare TURN credentials:', error);
    return res.status(200).json({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ]
    });
  }
});

// 5. Serve frontend static files in production / Koyeb deployment
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// Fallback all other routes to index.html for Single Page App routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      next();
    }
  });
});


// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Video Consultation server running on port ${PORT}`);
});
