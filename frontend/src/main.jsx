import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { PushNotificationProvider } from './context/PushNotificationProvider'
import { SocketProvider } from './context/SocketContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PushNotificationProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </PushNotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
