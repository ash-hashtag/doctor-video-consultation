import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  roomId: string;
  status: 'active' | 'ended';
  doctorJoined: boolean;
  patientJoined: boolean;
  doctorSocketId?: string;
  patientSocketId?: string;
  doctorName?: string;
  patientName?: string;
  createdAt: Date;
  endedAt?: Date;
}

const RoomSchema: Schema = new Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['active', 'ended'], default: 'active' },
    doctorJoined: { type: Boolean, default: false },
    patientJoined: { type: Boolean, default: false },
    doctorSocketId: { type: String },
    patientSocketId: { type: String },
    doctorName: { type: String },
    patientName: { type: String },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IRoom>('Room', RoomSchema);
