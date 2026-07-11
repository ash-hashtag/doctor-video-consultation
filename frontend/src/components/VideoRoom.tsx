import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Send, MessageSquare, ShieldAlert } from 'lucide-react';
import { useWebRTC } from '../hooks/useWebRTC';

interface VideoRoomProps {
  roomId: string;
  role: 'doctor' | 'patient';
  name: string;
  onLeaveRoom: () => void;
}

export const VideoRoom: React.FC<VideoRoomProps> = ({ roomId, role, name, onLeaveRoom }) => {
  const {
    localStream,
    remoteStream,
    isPeerJoined,
    isMuted,
    isCameraOff,
    isPeerMuted,
    isPeerCameraOff,
    error,
    messages,
    sendMessage,
    toggleMute,
    toggleCamera,
    endCall,
    doctorName,
    patientName,
  } = useWebRTC(roomId, role, name, onLeaveRoom);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  
  // Track chat open/close state (close by default on mobile)
  const [showChat, setShowChat] = useState(() => window.innerWidth > 768);
  const [chatInput, setChatInput] = useState('');

  // Bind local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isCameraOff]);

  // Bind remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isPeerCameraOff, isPeerJoined]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendMessage(chatInput);
    setChatInput('');
  };

  // Determine peer name exactly as entered
  const peerName = role === 'doctor' ? (patientName || 'Patient') : (doctorName || 'Doctor');

  return (
    <div className={`consultation-container ${showChat ? 'with-chat' : ''}`}>
      {/* Video Workspace */}
      <div className="video-workspace">
        {error && (
          <div className="error-banner" style={{ position: 'absolute', top: '1.5rem', zIndex: 100, width: '90%' }}>
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <div className={`video-grid ${isPeerJoined ? 'dual' : 'single'}`}>
          {/* Local Video Card */}
          <div className="video-card">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`video-feed ${isCameraOff ? 'hidden' : ''}`}
            />
            {isCameraOff && (
              <div className="avatar-placeholder">
                <div className="avatar-circle">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="placeholder-text">{name} (You) - Video Off</div>
              </div>
            )}
            
            <div className="video-overlay-info">
              <div className="indicator-dot active" />
              <span>{name} (You)</span>
              {isMuted && <span style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600 }}>[MUTED]</span>}
            </div>
          </div>

          {/* Remote Video Card */}
          {isPeerJoined && (
            <div className="video-card">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`video-feed ${isPeerCameraOff ? 'hidden' : ''}`}
              />
              {isPeerCameraOff && (
                <div className="avatar-placeholder">
                  <div className="avatar-circle">
                    {peerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="placeholder-text">{peerName} - Video Off</div>
                </div>
              )}

              <div className="video-overlay-info">
                <div className="indicator-dot active" />
                <span>{peerName}</span>
                {isPeerMuted && <span style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600 }}>[MUTED]</span>}
              </div>
            </div>
          )}
        </div>

        {/* Floating Call Control Bar */}
        <div className="control-bar">
          <button
            onClick={toggleMute}
            className={`control-btn ${isMuted ? 'muted' : ''}`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button
            onClick={toggleCamera}
            className={`control-btn ${isCameraOff ? 'muted' : ''}`}
            title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className={`control-btn ${showChat ? 'active' : ''}`}
            title="Toggle Consultation Chat"
          >
            <MessageSquare size={20} />
          </button>

          <button
            onClick={endCall}
            className="control-btn danger"
            title="Leave / End Consultation"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>

      {/* Right Sidebar - Chat & Notes */}
      <div className="consultation-sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquare size={16} style={{ color: 'var(--primary)' }} />
            <span className="sidebar-title" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Consultation Chat</span>
            <span className="chat-badge" style={{ fontSize: '0.65rem' }}>{messages.length}</span>
          </div>
          <button 
            onClick={() => setShowChat(false)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', display: 'flex', padding: '4px' }}
            title="Close Chat"
          >
            ✕
          </button>
        </div>

        {/* Chat History */}
        <div className="chat-history">
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
              <p>No messages yet.</p>
              <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-dark)' }}>Type a message below to share notes or symptoms.</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`chat-message-bubble ${msg.sender === 'self' ? 'self' : 'peer'}`}
              >
                <div className="message-meta">
                  <span>{msg.sender === 'self' ? 'You' : peerName}</span>
                  <span>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="message-content">{msg.text}</div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Message Input Box */}
        <form onSubmit={handleSendChat} className="chat-input-area">
          <input
            type="text"
            className="chat-input"
            placeholder="Type message..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
          />
          <button type="submit" className="chat-send-btn">
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
};
