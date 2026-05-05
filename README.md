# 💬 WhatsApp Web Clone (Full-Stack MERN)

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io/)

A high-performance, real-time messaging platform inspired by WhatsApp Web. This project demonstrates a production-ready implementation of the MERN stack, emphasizing **real-time synchronization**, **security**, and **premium UX/UI**.

---

## 🏗️ Technical Architecture

### **Frontend**
- **Core**: React 18 with Vite for optimized build times.
- **State Management**: Context API for global authentication and real-time socket states.
- **Styling**: Vanilla CSS with a custom-built **Glassmorphism Design System** for a premium look.
- **Animations**: Framer Motion and GSAP for buttery-smooth micro-interactions.
- **Real-time**: Socket.IO client for persistent duplex communication.

### **Backend**
- **API**: Express.js with a modular controller-service architecture.
- **Database**: MongoDB with Mongoose (optimized with indexes for fast search).
- **Authentication**: Dual-path Auth (Email/OTP & Phone/Password) using JWT and Firebase Admin SDK.
- **Real-time Engine**: Socket.IO with dynamic room management for private and group chats.

---

## 🌟 Key Engineering Highlights

### **1. Real-time Synchronization Engine**
Implemented a robust Socket.IO layer that handles:
- **Presence Tracking**: Real-time "Online/Last Seen" status updates.
- **Delivery Receipts**: Interactive double-tick system (Sent/Read states).
- **Typing Indicators**: Real-time feedback when a contact is typing.

### **2. Hybrid Authentication System**
Developed a flexible authentication layer that supports multiple identity providers:
- **Phone-First Flow**: Optimized for mobile-heavy regions (Direct identifier + password).
- **Email/OTP Flow**: Secure email-based sign-up with expiring verification codes.
- **Social Auth**: Google OAuth integration via Firebase for a friction-less experience.

### **3. Optimized Search & Scalability**
- **Database Indexing**: Implemented `sparse` and `unique` indexes on Phone/Email fields in MongoDB to ensure $O(1)$ lookup performance.
- **Regex Search**: Built a high-performance user search that queries across Username, Email, and Phone number simultaneously.

---

## 🔑 Configuration & Environment Variables

### **Backend Setup (`backend/.env`)**
Create a `.env` file in the `backend` folder. **Crucial:** Ensure the `FIREBASE_PRIVATE_KEY` is wrapped in quotes and contains actual line breaks (`\n`).

| Variable | Requirement | Description |
| :--- | :--- | :--- |
| `PORT` | Optional | Port for the server (default: 5000). |
| `MONGODB_URI` | **Required** | Your MongoDB connection string. |
| `JWT_SECRET` | **Required** | Random string for token signing. |
| `EMAIL_USER` | Optional | Gmail address for OTPs. |
---

## 🛠️ Getting Started

### **1. Environment Variables Setup**
Create a `.env` file in both the `backend/` and `frontend/` directories.

#### **Backend (`backend/.env`)**
| Key | Description |
| :--- | :--- |
| `PORT` | Server port (default: 5000) |
| `MONGODB_URI` | MongoDB connection string (Local or Atlas) |
| `JWT_SECRET` | Secure string for signing JWT tokens |
| `FIREBASE_PROJECT_ID` | From Firebase Service Account JSON |
| `FIREBASE_CLIENT_EMAIL` | From Firebase Service Account JSON |
| `FIREBASE_PRIVATE_KEY` | From Firebase Service Account JSON (handle `\n`) |

#### **Frontend (`frontend/.env`)**
| Key | Description |
| :--- | :--- |
| `VITE_API_URL` | Backend URL (e.g., http://localhost:5000) |
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |
| `VITE_FIREBASE_VAPID_KEY` | Generated in Firebase Console > Cloud Messaging |

---

### **2. Installation & Running (Local)**

**Backend:**
```bash
cd backend && npm install && npm start
```

**Frontend:**
```bash
cd frontend && npm install && npm run dev
```

---

## 🚀 Super Simple 5-Minute Setup

If you want to run this project **right now** without typing many commands, follow these simple steps:

### **Step 1: Copy the Secret Files**
Go into the `backend` folder and the `frontend` folder. Look for files named `.env.example`. 
- **Rename them** to just `.env`. (Remove the `.example` part).

### **Step 2: Get your Magic Keys (Firebase)**
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project called "My WhatsApp".
3. Click the **Gear icon ⚙️** > **Project Settings**.
4. **For the Frontend**: Copy the "Web App" config keys into `frontend/.env`.
5. **For the Backend**: Click **Service Accounts** > **Generate New Private Key**. Open that file and copy the values into `backend/.env`.

### **Step 3: The One-Click Start**
Make sure you have **Docker Desktop** open. Now, open your terminal in the main folder and type:
```bash
docker-compose up --build
```
*Wait for a few minutes while the computer builds the app...* ☕

### **Step 4: Open the App!**
Once the terminal stops moving, open your browser and go to:
👉 **http://localhost**

---

## 🛠️ Advanced Setup (Manual)

The easiest way to run the entire stack (Frontend, Backend, and MongoDB) is using Docker Compose.

### **Quick Start**
1. Ensure you have **Docker** and **Docker Compose** installed.
2. Configure your `.env` files in both `backend/` and `frontend/` folders.
3. Run the following command in the root directory:
   ```bash
   docker-compose up --build
   ```
4. Access the application:
   - **Frontend**: [http://localhost:80](http://localhost:80)
   - **Backend API**: [http://localhost:5000](http://localhost:5000)
   - **API Docs**: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)

---

## 📂 Project Structure

```
├── backend
│   ├── src
│   │   ├── config        # DB & Firebase Initialization
│   │   ├── controllers   # Business Logic
│   │   ├── models        # Mongoose Schemas
│   │   ├── routes        # API Endpoints
│   │   └── services      # Third-party integrations (Email/SMS)
├── frontend
│   ├── src
│   │   ├── api           # Axios Interceptors
│   │   ├── components    # Atomic Design UI Components
│   │   ├── context       # Socket & Auth State
│   │   └── lib           # External Library Config
```

---

## 🛡️ Architecture & Security

### **12-Factor App Compliance**
> "I purposely did not bake the backend environment variables into the Docker image to follow the **12-Factor App security principles**. Instead, I provided a `docker-compose.prod.yml` that allows the user to inject their own secrets safely at runtime."

### **Key Technical Decisions**
- **State Management**: Implemented **Zustand** for atomic state updates, significantly reducing re-renders compared to standard React Context.
- **Service Workers**: Used **Firebase Cloud Messaging (FCM)** with a background Service Worker to ensure real-time push notifications even when the browser tab is closed.
- **E2EE**: End-to-End Encryption is handled client-side; the server only stores encrypted blobs and public keys.
- **Containerization**: Multi-stage Docker builds ensure that the production frontend is served via a hardened Nginx instance, while the backend remains isolated.

---

## 📸 Project Showcase

> [!TIP]
> This project features a custom-built Glassmorphism UI. Key visual highlights include:
> - **Real-time Chat Interface**: Transparent message bubbles with backdrop-blur effects.
> - **Dynamic Sidebars**: Smooth transitions between chats and group management.
> - **Authentication UI**: Intuitive multi-path login screens with animated transitions.

---

## 🛠️ Challenges Faced & Solutions

- **Challenge**: Handling socket reconnections without losing message state.
  - **Solution**: Implemented a "Sync on Reconnect" logic that fetches missed messages from the database whenever the socket client reconnects.
- **Challenge**: Achieving a "Premium" look without heavy third-party CSS frameworks.
  - **Solution**: Custom-built a CSS variables-based design system using `backdrop-filter` and HSL color palettes for a consistent glassmorphism theme.

---

## 📈 Future Roadmap
- [ ] End-to-End Encryption (E2EE) using Signal Protocol.
- [ ] Voice and Video calls via WebRTC.
- [ ] File and Image sharing (S3 Integration).
- [ ] PWA support for mobile installation.
