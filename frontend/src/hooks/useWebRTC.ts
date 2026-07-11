import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from '../config';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

interface Message {
  sender: 'self' | 'peer';
  text: string;
  timestamp: Date;
}

export const useWebRTC = (
  roomId: string,
  role: 'doctor' | 'patient',
  name: string,
  onCallEnded?: () => void
) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isPeerJoined, setIsPeerJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isPeerMuted, setIsPeerMuted] = useState(false);
  const [isPeerCameraOff, setIsPeerCameraOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Track actual participant names dynamically
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Initialize Socket.io and Media Stream
  useEffect(() => {
    // 1. Setup media devices (mic/camera)
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: true,
        });
        
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch (err) {
        console.error('Error accessing media devices:', err);
        setError('Could not access microphone/camera. Please check permissions.');
      }
    };

    initMedia();

    // 2. Connect to Socket.io
    const socket = io(BACKEND_URL, {
      withCredentials: true,
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to signaling server');
    });

    socket.on('connect_error', () => {
      setError('Failed to connect to video server. Reconnecting...');
    });

    // Handle duplicate join errors or DB issues
    socket.on('error-msg', (msg: string) => {
      console.error('Signaling server error:', msg);
      setError(msg);
      // Exit and return to lobby on error
      setTimeout(() => {
        cleanupCall();
        if (onCallEnded) onCallEnded();
      }, 3000);
    });

    return () => {
      cleanupCall();
    };
  }, []);

  // Cleanup helper
  const cleanupCall = useCallback(() => {
    // Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      setRemoteStream(null);
      remoteStreamRef.current = null;
    }

    // Leave room and disconnect socket
    if (socketRef.current) {
      socketRef.current.emit('leave-room', { roomId });
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsJoined(false);
    setIsPeerJoined(false);
    setDoctorName(null);
    setPatientName(null);
  }, [roomId]);

  // Join Room once socket and local stream are both ready
  useEffect(() => {
    if (!socketRef.current || !localStream) return;

    const socket = socketRef.current;

    // Join signaling room with our role and name
    socket.emit('join-room', { roomId, role, name });
    setIsJoined(true);

    // Create RTCPeerConnection and bind event handlers
    const createPeerConnection = () => {
      if (peerConnectionRef.current) return peerConnectionRef.current;

      console.log('Creating RTCPeerConnection...');
      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnectionRef.current = pc;

      // Add local tracks to peer connection
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      // Handle remote tracks
      pc.ontrack = (event) => {
        console.log('Received remote track', event.streams);
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
          setRemoteStream(event.streams[0]);
        } else {
          if (!remoteStreamRef.current) {
            remoteStreamRef.current = new MediaStream();
            setRemoteStream(remoteStreamRef.current);
          }
          remoteStreamRef.current.addTrack(event.track);
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          console.log('Generated local ICE candidate');
          socketRef.current.emit('ice-candidate', {
            roomId,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('Connection state change:', pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          console.log('Peer disconnected or failed');
          setRemoteStream(null);
          remoteStreamRef.current = null;
          setIsPeerJoined(false);
        }
      };

      return pc;
    };

    // Signaling Listener: Peer Joined
    socket.on('peer-joined', async (data: { socketId: string; role: 'doctor' | 'patient'; name: string }) => {
      console.log(`Peer joined: ${data.socketId} as ${data.role} (${data.name})`);
      setIsPeerJoined(true);
      
      if (data.role === 'doctor') {
        setDoctorName(data.name);
      } else {
        setPatientName(data.name);
      }

      if (role === 'patient') {
        try {
          const pc = createPeerConnection();
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { roomId, sdp: offer });
          console.log('Offer sent to Doctor');
        } catch (err) {
          console.error('Failed to create offer:', err);
        }
      }
    });

    // Signaling Listener: Room status details containing names
    socket.on('room-status', (data: { doctorJoined: boolean; patientJoined: boolean; doctorName?: string; patientName?: string }) => {
      const isOtherJoined = role === 'doctor' ? data.patientJoined : data.doctorJoined;
      setIsPeerJoined(isOtherJoined);

      if (data.doctorName) setDoctorName(data.doctorName);
      if (data.patientName) setPatientName(data.patientName);

      // If the other peer is already in the room when we join, patient will initiate the offer.
      if (isOtherJoined && role === 'patient') {
        setTimeout(async () => {
          try {
            const pc = createPeerConnection();
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('offer', { roomId, sdp: offer });
            console.log('Delayed offer sent to Doctor');
          } catch (err) {
            console.error('Failed to create delayed offer:', err);
          }
        }, 1000);
      }
    });

    // Signaling Listener: SDP Offer (Received by Doctor)
    socket.on('offer', async (data: { sdp: RTCSessionDescriptionInit; sender: string }) => {
      console.log('Received SDP offer from Patient');
      try {
        const pc = createPeerConnection();
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('answer', { roomId, sdp: answer });
        console.log('Answer sent to Patient');
      } catch (err) {
        console.error('Failed to handle SDP offer:', err);
      }
    });

    // Signaling Listener: SDP Answer (Received by Patient)
    socket.on('answer', async (data: { sdp: RTCSessionDescriptionInit; sender: string }) => {
      console.log('Received SDP answer from Doctor');
      try {
        const pc = peerConnectionRef.current;
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        }
      } catch (err) {
        console.error('Failed to handle SDP answer:', err);
      }
    });

    // Signaling Listener: ICE Candidate
    socket.on('ice-candidate', async (data: { candidate: RTCIceCandidateInit; sender: string }) => {
      console.log('Received remote ICE candidate');
      try {
        const pc = peerConnectionRef.current;
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (err) {
        console.error('Failed to add ICE candidate:', err);
      }
    });

    // Peer Device Control Updates
    socket.on('peer-toggle-audio', (data: { enabled: boolean }) => {
      setIsPeerMuted(!data.enabled);
    });

    socket.on('peer-toggle-video', (data: { enabled: boolean }) => {
      setIsPeerCameraOff(!data.enabled);
    });

    // Chat Message listener
    socket.on('chat-message', (data: { text: string; senderRole: string; timestamp: string }) => {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'peer',
          text: data.text,
          timestamp: new Date(data.timestamp),
        },
      ]);
    });

    // Signaling Listener: Peer Left
    socket.on('peer-left', (data: { role: string }) => {
      console.log('Peer left room');
      setIsPeerJoined(false);
      setRemoteStream(null);
      remoteStreamRef.current = null;
      setIsPeerMuted(false);
      setIsPeerCameraOff(false);
      
      if (data.role === 'doctor') {
        setDoctorName(null);
      } else {
        setPatientName(null);
      }
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
    });

    return () => {
      socket.off('peer-joined');
      socket.off('room-status');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('peer-toggle-audio');
      socket.off('peer-toggle-video');
      socket.off('chat-message');
      socket.off('peer-left');
    };
  }, [localStream, roomId, role, name, cleanupCall]);

  // Toggle Mute Audio locally
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        const nextState = !audioTrack.enabled;
        audioTrack.enabled = nextState;
        setIsMuted(!nextState);

        if (socketRef.current) {
          socketRef.current.emit('toggle-audio', { roomId, enabled: nextState });
        }
      }
    }
  }, [roomId]);

  // Toggle Camera Video locally
  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const nextState = !videoTrack.enabled;
        videoTrack.enabled = nextState;
        setIsCameraOff(!nextState);

        if (socketRef.current) {
          socketRef.current.emit('toggle-video', { roomId, enabled: nextState });
        }
      }
    }
  }, [roomId]);

  // End Call functionality
  const endCall = useCallback(() => {
    cleanupCall();
    if (onCallEnded) {
      onCallEnded();
    }
  }, [cleanupCall, onCallEnded]);

  // Send chat message through sockets
  const sendChatMessage = useCallback((text: string) => {
    if (!socketRef.current || !text.trim()) return;
    const msg = {
      roomId,
      text,
      timestamp: new Date().toISOString(),
    };
    socketRef.current.emit('chat-message', msg);
    setMessages((prev) => [
      ...prev,
      {
        sender: 'self',
        text,
        timestamp: new Date(),
      },
    ]);
  }, [roomId]);

  return {
    localStream,
    remoteStream,
    isJoined,
    isPeerJoined,
    isMuted,
    isCameraOff,
    isPeerMuted,
    isPeerCameraOff,
    error,
    messages,
    sendMessage: sendChatMessage,
    toggleMute,
    toggleCamera,
    endCall,
    doctorName,
    patientName,
  };
};
