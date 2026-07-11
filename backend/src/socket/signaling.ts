import { Server, Socket } from 'socket.io';
import Room from '../models/Room';

interface JoinPayload {
  roomId: string;
  role: 'doctor' | 'patient';
  name: string;
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
      const { roomId, role, name } = payload;
      
      if (!roomId || !['doctor', 'patient'].includes(role) || !name) {
        socket.emit('error-msg', 'Invalid room ID, role, or name');
        return;
      }

      console.log(`Socket ${socket.id} joining room ${roomId} as ${role} (Name: ${name})`);

      try {
        // Find or create the room in DB
        let room = await Room.findOne({ roomId });
        if (!room) {
          room = new Room({ roomId, status: 'active' });
        } else if (room.status === 'ended') {
          room.status = 'active';
          room.endedAt = undefined;
        }

        // Check if role is already filled by an active socket
        if (role === 'doctor') {
          if (room.doctorJoined && room.doctorSocketId && room.doctorSocketId !== socket.id) {
            const isOldSocketConnected = io.sockets.sockets.has(room.doctorSocketId);
            if (isOldSocketConnected) {
              socket.emit('error-msg', 'A Doctor has already joined this consultation room.');
              return;
            }
          }
          // Allocate room slot
          room.doctorJoined = true;
          room.doctorSocketId = socket.id;
          room.doctorName = name;
        } else {
          if (room.patientJoined && room.patientSocketId && room.patientSocketId !== socket.id) {
            const isOldSocketConnected = io.sockets.sockets.has(room.patientSocketId);
            if (isOldSocketConnected) {
              socket.emit('error-msg', 'A Patient has already joined this consultation room.');
              return;
            }
          }
          // Allocate room slot
          room.patientJoined = true;
          room.patientSocketId = socket.id;
          room.patientName = name;
        }

        currentRoomId = roomId;
        currentRole = role;
        socket.join(roomId);

        await room.save();

        // Notify everyone in the room about the updated status and participant names
        io.to(roomId).emit('room-status', {
          roomId,
          doctorJoined: room.doctorJoined,
          patientJoined: room.patientJoined,
          doctorName: room.doctorName,
          patientName: room.patientName,
          status: room.status,
        });

        // Notify other participants in the room that a peer has joined
        socket.to(roomId).emit('peer-joined', {
          socketId: socket.id,
          role: role,
          name: name,
        });

        console.log(`Room status updated: Doctor=${room.doctorName} (${room.doctorJoined}), Patient=${room.patientName} (${room.patientJoined})`);
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

        // Reset flags only if the disconnecting socket is the one registered
        if (currentRole === 'doctor' && room.doctorSocketId === clientSocket.id) {
          room.doctorJoined = false;
          room.doctorSocketId = undefined;
          room.doctorName = undefined;
        } else if (currentRole === 'patient' && room.patientSocketId === clientSocket.id) {
          room.patientJoined = false;
          room.patientSocketId = undefined;
          room.patientName = undefined;
        }

        // If both left, set status to ended
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
          doctorName: room.doctorName,
          patientName: room.patientName,
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
