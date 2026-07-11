import { useState, useEffect } from 'react';
import { Lobby } from './components/Lobby';
import { VideoRoom } from './components/VideoRoom';
import { BACKEND_URL } from './config';
import { HeartPulse } from 'lucide-react';

interface JoinState {
  roomId: string;
  role: 'doctor' | 'patient';
  name: string;
}

// Extract room ID from URL path (e.g. /room-123 -> room-123)
const getRoomIdFromUrl = (): string => {
  const path = window.location.pathname;
  if (path && path.length > 1) {
    const cleaned = path.substring(1).trim();
    // Ignore direct files like index.html
    if (cleaned && cleaned !== 'index.html' && !cleaned.includes('.')) {
      return cleaned;
    }
  }
  return '';
};

function App() {
  const [session, setSession] = useState<JoinState | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [initialRoomId, setInitialRoomId] = useState(getRoomIdFromUrl);
  const [isAutoReconnecting, setIsAutoReconnecting] = useState(false);

  // Sync state with back/forward browser navigation
  useEffect(() => {
    const handlePopState = () => {
      const currentRoom = getRoomIdFromUrl();
      setInitialRoomId(currentRoom);
      if (!currentRoom) {
        setSession(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle Join Room
  const handleJoin = async (roomId: string, role: 'doctor' | 'patient', name: string) => {
    try {
      // Call backend API to create/verify room
      const res = await fetch(`${BACKEND_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      });

      if (!res.ok) {
        throw new Error('Failed to register consultation room with backend server');
      }

      // Update Session
      setSession({ roomId, role, name });
      setApiError(null);

      // Save credentials for auto-reconnection
      localStorage.setItem('sehaat_saathi_name', name);
      localStorage.setItem('sehaat_saathi_role', role);

      // Update URL route to /roomId
      if (getRoomIdFromUrl() !== roomId) {
        window.history.pushState(null, '', `/${roomId}`);
      }
    } catch (err) {
      console.error(err);
      setApiError('Unable to connect to the consultation service. Please check if backend is running.');
      // Clear storage on failure to prevent loops
      localStorage.removeItem('sehaat_saathi_name');
      localStorage.removeItem('sehaat_saathi_role');
    }
  };

  // Auto-reconnect on boot if credentials and URL roomId exist
  useEffect(() => {
    const autoReconnect = async () => {
      const currentRoom = getRoomIdFromUrl();
      const savedName = localStorage.getItem('sehaat_saathi_name');
      const savedRole = localStorage.getItem('sehaat_saathi_role') as 'doctor' | 'patient' | null;

      if (currentRoom && savedName && savedRole && (savedRole === 'doctor' || savedRole === 'patient')) {
        setIsAutoReconnecting(true);
        console.log(`Auto-reconnecting to room '${currentRoom}' as ${savedRole}...`);
        await handleJoin(currentRoom, savedRole, savedName);
        setIsAutoReconnecting(false);
      }
    };
    autoReconnect();
  }, []);

  // Handle Leave Room
  const handleLeave = () => {
    setSession(null);
    setInitialRoomId('');
    
    // Clear saved session keys
    localStorage.removeItem('sehaat_saathi_name');
    localStorage.removeItem('sehaat_saathi_role');

    // Restore URL route to root /
    window.history.pushState(null, '', '/');
  };

  return (
    <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="header" style={{ height: '60px', flexShrink: 0 }}>
        <div className="logo-container">
          <div className="logo-icon">
            <HeartPulse size={16} />
          </div>
          <span className="logo-text">Sehaat Saathi</span>
        </div>

        {session && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Room ID: <strong style={{ color: 'white' }}>{session.roomId}</strong>
            </span>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {apiError && !session && (
          <div className="error-banner" style={{ margin: '1.5rem auto 0 auto', width: '90%', maxWidth: '440px', flexShrink: 0 }}>
            <span>{apiError}</span>
          </div>
        )}

        {isAutoReconnecting ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <div className="indicator-dot active" style={{ width: '12px', height: '12px', marginBottom: '1rem' }} />
            <span>Re-connecting to active consultation room...</span>
          </div>
        ) : session ? (
          <VideoRoom
            roomId={session.roomId}
            role={session.role}
            name={session.name}
            onLeaveRoom={handleLeave}
          />
        ) : (
          <Lobby onJoinRoom={handleJoin} initialRoomId={initialRoomId} />
        )}
      </main>
    </div>
  );
}

export default App;
