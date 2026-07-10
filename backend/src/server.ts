import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
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

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Video Consultation server running on port ${PORT}`);
});
