# Sehaat Saathi - Video Consultation Module

A secure, high-performance, and responsive WebRTC-based video consultation module prototype designed for the **Sehaat Saathi** telehealth platform. 

This module allows doctors and patients to enter virtual consultation rooms, communicate via low-latency peer-to-peer audio/video streaming, toggle media hardware, and exchange live text notes (chat) for symptoms and prescriptions.

---

## 🚀 Key Features

* **Secure WebRTC Video & Audio**: Low-latency, encrypted peer-to-peer streaming directly between doctor and patient browser instances.
* **Socket.io Signaling Gateway**: Synchronizes the WebRTC handshake (SDP offers/answers, ICE candidates) and coordinates connection states.
* **Clinical Glassmorphic UI**: High-end modern dark UI styled with Outfit typography, custom HSL color systems, and CSS micro-animations.
* **Persistent Session Auditing**: Connects to MongoDB to keep track of active room memberships and automatically ends session states on user exit.
* **Device Synchronization**: Live indicators showing if the other peer has muted their microphone or disabled their video feed.
* **In-Call Real-Time Chat**: Shared side-panel chat window to exchange prescription links, comments, and consultation details.

---

## 🛠️ Technology Stack

* **Frontend**: React 19, TypeScript, Vite, Lucide Icons, and Vanilla CSS.
* **Backend**: Node.js, Express, TypeScript, Socket.io (Signaling server).
* **Database**: MongoDB (Mongoose) for session persistence.
* **Containers**: Docker (for database orchestration).
* **Package Management**: `pnpm` (fast, monorepo-friendly).

---

## 📐 Architecture & Signaling Flow

WebRTC requires an initial signaling phase to discover peers and exchange network configurations. Below is the workflow orchestration implemented in this prototype:

```
[Patient Client]          [Socket.io Signaling Server]          [Doctor Client]
      │                                 │                              │
      ├────── Join room (patient) ─────>│                              │
      │                                 │<───── Join room (doctor) ────┤
      │                                 │                              │
      │<──────── Peer Joined ───────────┤                              │
      │                                 │───────── Peer Joined ───────>│
      │                                 │                              │
      ├────────── SDP Offer ───────────>│                              │
      │                                 │────────── SDP Offer ────────>│
      │                                 │                              │
      │                                 │<───────── SDP Answer ────────┤
      │<───────── SDP Answer ───────────┤                              │
      │                                 │                              │
      │<─────── ICE Candidates ────────>│<─────── ICE Candidates ─────>│
      │                                 │                              │
      ├────────────────────── P2P Direct Media ────────────────────────┤
```

---

## 🏁 Running the Application

Follow these steps to run the prototype locally on your system:

### Prerequisites
* **Node.js** (v18 or higher)
* **pnpm** package manager (`npm install -g pnpm`)
* **Docker**

---

### Option A: Run Containerized via Docker Compose (Recommended)
If you have Docker Compose installed, you can boot the entire stack (Database, Backend, and Frontend) in one command:
```bash
docker compose up --build
```

---

### Option B: Docker Fallback (If Docker Compose is missing)
If you have Docker installed but don't have the Compose plugin, run our fallback orchestrator:
```bash
./start-docker.sh
```

---

### Option C: Run Locally on Host (Fastest for Dev HMR)
If you want to run the React client and Node server directly on your host machine:

#### Step 1: Start MongoDB container
```bash
docker run -d --name sehaat_saathi_db -p 27017:27017 mongo:6.0
```

#### Step 2: Start Express Backend
1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Install packages & start the server:
   ```bash
   pnpm install && pnpm run dev
   ```

#### Step 3: Start Vite Frontend
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install packages & start client:
   ```bash
   pnpm install && pnpm run dev
   ```

## 🧪 Testing the Video Call

1. Open two browser windows side-by-side at `http://localhost:5173`.
2. **In Window 1 (Patient):**
   * Enter your name (e.g. `Jane Doe`).
   * Select the **Patient** role.
   * Enter a room code (e.g., `consult-101`).
   * Click **Join Consultation**.
3. **In Window 2 (Doctor):**
   * Enter your name (e.g. `Dr. Sarah`).
   * Select the **Doctor** role.
   * Enter the **same** room code (`consult-101`).
   * Click **Join Consultation**.
4. Both cameras will start, and the WebRTC peer connection will form automatically.
5. Try mute controls, turning the video off, and sending chat messages to see real-time UI synchronization!
