import { Server, Socket } from 'socket.io';
import Room from '../models/Room';

interface JoinPayload {
  roomId: string;
  role: 'doctor' | 'patient';
}

interface SignalPayload {
  roomId: string;
  sdp?: any;
  candidate?: any;
}

interface TogglePayload {
  roomId: string;
  enabled: boolean;
}

export const setupSignaling = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Track room details on the socket instance
    let currentRoomId: string | null = null;
    let currentRole: 'doctor' | 'patient' | null = null;

    // Join room
    socket.on('join-room', async (payload: JoinPayload) => {
      const { roomId, role } = payload;
      
      if (!roomId || !['doctor', 'patient'].includes(role)) {
        socket.emit('error-msg', 'Invalid room ID or role');
        return;
      }

      console.log(`Socket ${socket.id} joining room ${roomId} as ${role}`);
      
      currentRoomId = roomId;
      currentRole = role;
      socket.join(roomId);

      try {
        // Find or create the room in DB
        let room = await Room.findOne({ roomId });
        if (!room) {
          room = new Room({ roomId, status: 'active' });
        } else if (room.status === 'ended') {
          room.status = 'active';
          room.endedAt = undefined;
        }

        // Update role join status
        if (role === 'doctor') {
          room.doctorJoined = true;
        } else {
          room.patientJoined = true;
        }
        await room.save();

        // Notify everyone in the room about the updated status
        io.to(roomId).emit('room-status', {
          roomId,
          doctorJoined: room.doctorJoined,
          patientJoined: room.patientJoined,
          status: room.status,
        });

        // Notify other participants in the room that a peer has joined
        socket.to(roomId).emit('peer-joined', {
          socketId: socket.id,
          role: role,
        });

        console.log(`Room status updated for ${roomId}: Doctor=${room.doctorJoined}, Patient=${room.patientJoined}`);
      } catch (err) {
        console.error('Error on join-room:', err);
        socket.emit('error-msg', 'Database error during room join');
      }
    });

    // Handle SDP Offer
    socket.on('offer', (payload: SignalPayload) => {
      const { roomId, sdp } = payload;
      if (!roomId || !sdp) return;
      
      console.log(`Forwarding offer from ${socket.id} (role: ${currentRole}) to room ${roomId}`);
      socket.to(roomId).emit('offer', {
        sdp,
        sender: socket.id,
        role: currentRole,
      });
    });

    // Handle SDP Answer
    socket.on('answer', (payload: SignalPayload) => {
      const { roomId, sdp } = payload;
      if (!roomId || !sdp) return;

      console.log(`Forwarding answer from ${socket.id} (role: ${currentRole}) to room ${roomId}`);
      socket.to(roomId).emit('answer', {
        sdp,
        sender: socket.id,
        role: currentRole,
      });
    });

    // Handle ICE Candidates
    socket.on('ice-candidate', (payload: SignalPayload) => {
      const { roomId, candidate } = payload;
      if (!roomId || !candidate) return;

      console.log(`Forwarding ICE candidate from ${socket.id} to room ${roomId}`);
      socket.to(roomId).emit('ice-candidate', {
        candidate,
        sender: socket.id,
      });
    });

    // Toggle Audio Status (Mute/Unmute)
    socket.on('toggle-audio', (payload: TogglePayload) => {
      const { roomId, enabled } = payload;
      if (!roomId) return;
      socket.to(roomId).emit('peer-toggle-audio', {
        sender: socket.id,
        role: currentRole,
        enabled,
      });
    });

    // Toggle Video Status (Camera On/Off)
    socket.on('toggle-video', (payload: TogglePayload) => {
      const { roomId, enabled } = payload;
      if (!roomId) return;
      socket.to(roomId).emit('peer-toggle-video', {
        sender: socket.id,
        role: currentRole,
        enabled,
      });
    });

    // Handle Chat Messages
    socket.on('chat-message', (payload: { roomId: string; text: string; timestamp: string }) => {
      const { roomId, text, timestamp } = payload;
      if (!roomId || !text) return;
      
      console.log(`Forwarding chat message from ${socket.id} to room ${roomId}`);
      socket.to(roomId).emit('chat-message', {
        text,
        senderRole: currentRole,
        timestamp,
      });
    });

    // End call / leave room explicitly
    socket.on('leave-room', async (payload: { roomId: string }) => {
      const { roomId } = payload;
      if (!roomId) return;

      console.log(`Socket ${socket.id} leaving room ${roomId}`);
      socket.leave(roomId);
      await handleUserExit(socket, roomId);
    });

    // Handle socket disconnect
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      if (currentRoomId) {
        await handleUserExit(socket, currentRoomId);
      }
    });

    // Helper function to handle user exit
    const handleUserExit = async (clientSocket: Socket, roomId: string) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        // Reset the corresponding flag
        if (currentRole === 'doctor') {
          room.doctorJoined = false;
        } else if (currentRole === 'patient') {
          room.patientJoined = false;
        }

        // If both left, we can set the room status to ended (or keep active depending on logic)
        // Let's set status to 'ended' and set endedAt if both participants are gone
        if (!room.doctorJoined && !room.patientJoined) {
          room.status = 'ended';
          room.endedAt = new Date();
        }

        await room.save();

        // Notify the remaining peer that the peer has left
        clientSocket.to(roomId).emit('peer-left', {
          socketId: clientSocket.id,
          role: currentRole,
        });

        // Broadcast room status update
        io.to(roomId).emit('room-status', {
          roomId,
          doctorJoined: room.doctorJoined,
          patientJoined: room.patientJoined,
          status: room.status,
        });

        console.log(`Exit handled for room ${roomId}. Active state: Doctor=${room.doctorJoined}, Patient=${room.patientJoined}`);
      } catch (err) {
        console.error('Error handling user exit:', err);
      } finally {
        currentRoomId = null;
        currentRole = null;
      }
    };
  });
};
