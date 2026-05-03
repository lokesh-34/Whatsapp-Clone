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
| `EMAIL_PASS` | Optional | Gmail App Password. |
| `FIREBASE_PROJECT_ID` | **Required** | From Firebase Service Account JSON. |
| `FIREBASE_PRIVATE_KEY` | **Required** | Must include `\n` characters. |

### **Frontend Setup (`frontend/.env`)**
Create a `.env` file in the `frontend` folder.

| Variable | Description |
| :--- | :--- |
| `VITE_API_URL` | `http://localhost:5000` (or your backend URL). |
| `VITE_FIREBASE_*` | Standard Web SDK keys from Firebase Console. |

---

## 🗄️ Database & Firebase Setup

### **1. MongoDB Setup**
- **Cloud (Atlas)**: Create a cluster at [MongoDB Atlas](https://www.mongodb.com/). Whitelist `0.0.0.0/0` in Network Access for testing.
- **Local**: Install [MongoDB Community Server](https://www.mongodb.com/try/download/community) and ensure it's running on port `27017`.

### **2. Firebase Service Account (Backend)**
To enable Google Login and token verification:
1. Go to **Firebase Console** > **Project Settings** > **Service Accounts**.
2. Click **Generate New Private Key**.
3. Copy the values from the JSON into your backend `.env`.

### **3. Firebase Web Config (Frontend)**
1. Go to **Firebase Console** > **Project Settings** > **General**.
2. Add a new "Web App" and copy the `firebaseConfig` object into your frontend `.env`.

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
