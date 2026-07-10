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
  } = useWebRTC(roomId, role, onLeaveRoom);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [chatInput, setChatInput] = useState('');

  // Bind local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Bind remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

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

  // Human readable label for the peer role
  const peerRoleLabel = role === 'doctor' ? 'Patient' : 'Doctor';
  const myRoleLabel = role === 'doctor' ? 'Doctor' : 'Patient';

  return (
    <div className="consultation-container">
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
            {isCameraOff ? (
              <div className="avatar-placeholder">
                <div className="avatar-circle">
                  {name.charAt(0).toUpperCase()}
                </div>
                <div className="placeholder-text">{name} (You) - Video Off</div>
              </div>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="video-feed"
              />
            )}
            
            <div className="video-overlay-info">
              <div className="indicator-dot active" />
              <span>{name} ({myRoleLabel})</span>
              {isMuted && <span style={{ color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600 }}>[MUTED]</span>}
            </div>
          </div>

          {/* Remote Video Card */}
          {isPeerJoined && (
            <div className="video-card">
              {isPeerCameraOff ? (
                <div className="avatar-placeholder">
                  <div className="avatar-circle">
                    {peerRoleLabel.charAt(0)}
                  </div>
                  <div className="placeholder-text">{peerRoleLabel} - Video Off</div>
                </div>
              ) : (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="video-feed"
                />
              )}

              <div className="video-overlay-info">
                <div className="indicator-dot active" />
                <span>{peerRoleLabel}</span>
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
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          <button
            onClick={toggleCamera}
            className={`control-btn ${isCameraOff ? 'muted' : ''}`}
            title={isCameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>

          <button
            onClick={endCall}
            className="control-btn danger"
            title="Leave / End Consultation"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>

      {/* Right Sidebar - Chat & Notes */}
      <div className="consultation-sidebar">
        <div className="sidebar-header">
          <h3 className="sidebar-title">
            <MessageSquare size={18} style={{ color: 'var(--accent)' }} />
            <span>Consultation Chat</span>
          </h3>
          <span className="chat-badge">{messages.length}</span>
        </div>

        {/* Chat History */}
        <div className="chat-history">
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <p>No messages yet.</p>
              <p>Type a message to share prescriptions,</p>
              <p>questions, or symptoms.</p>
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`chat-message-bubble ${msg.sender === 'self' ? 'self' : 'peer'}`}
              >
                <div className="message-meta">
                  <span>{msg.sender === 'self' ? 'You' : peerRoleLabel}</span>
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
            placeholder="Type message or share note..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
          />
          <button type="submit" className="chat-send-btn">
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
