import { useState } from 'react';
import { Lobby } from './components/Lobby';
import { VideoRoom } from './components/VideoRoom';
import { BACKEND_URL } from './config';
import { HeartPulse } from 'lucide-react';

interface JoinState {
  roomId: string;
  role: 'doctor' | 'patient';
  name: string;
}

function App() {
  const [session, setSession] = useState<JoinState | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

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

      setSession({ roomId, role, name });
      setApiError(null);
    } catch (err) {
      console.error(err);
      setApiError('Unable to connect to the consultation service. Please check if backend is running.');
    }
  };

  const handleLeave = () => {
    setSession(null);
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="logo-container">
          <div className="logo-icon">
            <HeartPulse size={20} />
          </div>
          <span className="logo-text">Sehaat Saathi</span>
          <span className="logo-badge">Teleconsult v1.0</span>
        </div>

        {session && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Room ID: <strong style={{ color: 'white' }}>{session.roomId}</strong>
            </span>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {apiError && !session && (
          <div className="error-banner" style={{ margin: '1.5rem auto 0 auto', width: '90%', maxWidth: '500px' }}>
            <span>{apiError}</span>
          </div>
        )}

        {session ? (
          <VideoRoom
            roomId={session.roomId}
            role={session.role}
            name={session.name}
            onLeaveRoom={handleLeave}
          />
        ) : (
          <Lobby onJoinRoom={handleJoin} />
        )}
      </main>
    </div>
  );
}

export default App;
