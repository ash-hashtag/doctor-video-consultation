import mongoose, { Schema, Document } from 'mongoose';

export interface IRoom extends Document {
  roomId: string;
  status: 'active' | 'ended';
  doctorJoined: boolean;
  patientJoined: boolean;
  createdAt: Date;
  endedAt?: Date;
}

const RoomSchema: Schema = new Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ['active', 'ended'], default: 'active' },
    doctorJoined: { type: Boolean, default: false },
    patientJoined: { type: Boolean, default: false },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IRoom>('Room', RoomSchema);
