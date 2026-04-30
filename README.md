# WhatsApp Web Clone

A full-stack real-time messaging application built to replicate the core functionality of WhatsApp Web.

![WhatsApp Clone Preview](./preview.png)

## ✨ Features

- 🔐 **JWT Authentication** — Register & login with email/password
- 💬 **Real-time Messaging** — Instant messages via Socket.IO (no page refresh)
- 🟢 **Online Presence** — Live online/offline status indicators
- 📜 **Message Persistence** — All messages stored in MongoDB
- ✅ **Read Receipts** — Grey/blue tick indicators
- ⌨️ **Typing Indicators** — See when the other person is typing
- 🔔 **Unread Badges** — Unread message count per conversation
- 🎨 **WhatsApp-accurate Dark UI** — Exact color palette & layout
- 📱 **Responsive** — Works on mobile devices

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router v6 |
| Styling | Vanilla CSS (WhatsApp dark theme) |
| HTTP Client | Axios |
| Real-time | Socket.IO Client |
| Backend | Node.js, Express |
| Real-time Server | Socket.IO |
| Database | MongoDB (Mongoose) |
| Auth | JWT (jsonwebtoken) + bcryptjs |

## 📁 Project Structure

```
Whatsapp Clone/
├── backend/
│   ├── src/
│   │   ├── config/db.js           # MongoDB connection
│   │   ├── models/
│   │   │   ├── User.js            # User schema
│   │   │   └── Message.js         # Message schema
│   │   ├── controllers/
│   │   │   ├── authController.js  # Register, Login, GetMe
│   │   │   ├── userController.js  # Get all users
│   │   │   └── messageController.js # Get/send messages
│   │   ├── middlewares/
│   │   │   ├── auth.js            # JWT verification
│   │   │   └── errorHandler.js    # Global error handler
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── users.js
│   │   │   └── messages.js
│   │   ├── socket/
│   │   │   └── socketHandler.js   # Socket.IO events
│   │   └── index.js               # Entry point
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── api/index.js           # Axios API client
    │   ├── context/
    │   │   ├── AuthContext.jsx    # Auth state
    │   │   └── SocketContext.jsx  # Socket connection
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Register.jsx
    │   │   └── Chat.jsx
    │   ├── components/
    │   │   ├── Sidebar/
    │   │   │   ├── Sidebar.jsx
    │   │   │   └── UserItem.jsx
    │   │   ├── ChatWindow/
    │   │   │   ├── ChatWindow.jsx
    │   │   │   ├── MessageList.jsx
    │   │   │   └── MessageInput.jsx
    │   │   └── MessageBubble.jsx
    │   ├── index.css              # Global styles
    │   └── main.jsx
    └── package.json
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+
- **npm** v9+
- **MongoDB** (local install OR MongoDB Atlas free tier)

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/whatsapp-clone.git
cd whatsapp-clone
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create your `.env` file:

```bash
cp .env.example .env
```

Edit `backend/.env`:

```env
PORT=5000
NODE_ENV=development

# Option A: Local MongoDB
MONGODB_URI=mongodb://localhost:27017/whatsapp-clone

# Option B: MongoDB Atlas
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/whatsapp-clone

JWT_SECRET=your_super_secret_key_here
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

Start the backend:

```bash
npm run dev
```

You should see:
```
✅ MongoDB Connected: ...
🚀 Server running on port 5000
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### 4. Test with Two Users

1. Open **http://localhost:5173/register** and create **User A**
2. Open an **incognito window** and go to **http://localhost:5173/register** → create **User B**
3. In the main window (User A), click on User B from the sidebar → start chatting!
4. Messages will appear in real-time in User B's window.

## 🔌 API Reference

### Auth

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | ❌ |
| POST | `/api/auth/login` | Login user | ❌ |
| GET | `/api/auth/me` | Get current user | ✅ |

### Users

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/users` | Get all users | ✅ |
| GET | `/api/users/:id` | Get user by ID | ✅ |

### Messages

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/messages/:userId` | Get conversation | ✅ |
| POST | `/api/messages/:userId` | Send message | ✅ |
| GET | `/api/messages/unread` | Get unread counts | ✅ |

### Health

```
GET /api/health
```

## 🔌 Socket.IO Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `sendMessage` | Client → Server | Send a message |
| `newMessage` | Server → Client | Receive real-time message |
| `onlineUsers` | Server → Client | List of online user IDs |
| `typing` | Client → Server | Typing started |
| `stopTyping` | Client → Server | Typing stopped |
| `userTyping` | Server → Client | Someone is typing |

## 🌍 Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `MONGODB_URI` | — | MongoDB connection string |
| `JWT_SECRET` | — | JWT signing secret |
| `JWT_EXPIRES_IN` | `7d` | JWT expiration |
| `CLIENT_URL` | `http://localhost:5173` | Frontend URL (CORS) |

## 📝 License

MIT
