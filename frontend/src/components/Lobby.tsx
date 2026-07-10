import React, { useState } from 'react';
import { Video, ShieldAlert } from 'lucide-react';

interface LobbyProps {
  onJoinRoom: (roomId: string, role: 'doctor' | 'patient', name: string) => void;
}

export const Lobby: React.FC<LobbyProps> = ({ onJoinRoom }) => {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState(() => {
    // Generate a default random clean code for testing convenience
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `room-${code}`;
  });
  const [role, setRole] = useState<'doctor' | 'patient'>('patient');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }
    setError('');
    onJoinRoom(roomId.trim(), role, name.trim());
  };

  return (
    <div className="lobby-container">
      <div className="lobby-card">
        <h2 className="lobby-title">Sehaat Saathi</h2>
        <p className="lobby-subtitle">Secure Telehealth Video Consultation Portal</p>

        {error && (
          <div className="error-banner">
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              placeholder={role === 'doctor' ? 'e.g. Dr. Sarah Saathi' : 'e.g. Patient John Doe'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Consultation Room ID</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. room-xyz123"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Select Your Role</label>
            <div className="role-selector">
              <div
                className={`role-option ${role === 'doctor' ? 'active' : ''}`}
                onClick={() => setRole('doctor')}
              >
                <span className="role-option-title">Doctor</span>
                <span className="role-option-desc">Host & conduct consultation</span>
              </div>
              <div
                className={`role-option ${role === 'patient' ? 'active' : ''}`}
                onClick={() => setRole('patient')}
              >
                <span className="role-option-title">Patient</span>
                <span className="role-option-desc">Join to seek medical consult</span>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary">
            <Video size={20} />
            <span>Join Consultation</span>
          </button>
        </form>

        <div className="lobby-footer">
          <p>🔒 Connections are secured using peer-to-peer WebRTC encryption.</p>
        </div>
      </div>
    </div>
  );
};
