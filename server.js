const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const compression = require('compression');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Enable compression for better performance
app.use(compression());

// Security and SEO headers
app.use((req, res, next) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Cache control for static assets
  if (req.url.match(/\.(js|css|jpg|jpeg|png|gif|ico|webp|svg)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
  } else if (req.url.match(/\.(html)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
  }
  
  next();
});

app.use(cors());
app.use(express.static('public', {
  maxAge: '1d', // Cache static files for 1 day
  etag: true,
  lastModified: true
}));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Store waiting users with timestamps
let waitingUsers = [];
// Store active connections
const activeConnections = new Map();
// Store user states
const userStates = new Map();

// Logging function with timestamp
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage, JSON.stringify(data));
}

// Get queue position for a user
function getQueuePosition(userId) {
  const index = waitingUsers.findIndex(user => user.id === userId);
  return index === -1 ? -1 : index + 1;
}

// Update queue positions for all waiting users
function updateQueuePositions() {
  waitingUsers.forEach((user, index) => {
    const socket = io.sockets.sockets.get(user.id);
    if (socket && socket.connected) {
      socket.emit('queue-update', { 
        position: index + 1, 
        total: waitingUsers.length 
      });
    }
  });
}

io.on('connection', (socket) => {
  log('INFO', 'New user connected', { userId: socket.id });
  userStates.set(socket.id, { state: 'connected', timestamp: Date.now() });

  // Send connection confirmation
  socket.emit('connection-confirmed', { userId: socket.id });

  // Handle user looking for a partner
  socket.on('find-partner', () => {
    log('INFO', 'User looking for partner', { userId: socket.id });
    
    // Check if user is already waiting or connected
    const currentState = userStates.get(socket.id);
    if (currentState && (currentState.state === 'waiting' || currentState.state === 'connected-to-partner')) {
      log('WARN', 'User already in queue or connected', { userId: socket.id, state: currentState.state });
      return;
    }

    // Check if there's someone waiting
    if (waitingUsers.length > 0) {
      // Get the first waiting user
      const partner = waitingUsers.shift();
      const partnerSocket = io.sockets.sockets.get(partner.id);
      
      if (partnerSocket && partnerSocket.connected) {
        log('INFO', 'Matching users', { user1: socket.id, user2: partner.id });
        
        // Update states
        userStates.set(socket.id, { state: 'connected-to-partner', partner: partner.id, timestamp: Date.now() });
        userStates.set(partner.id, { state: 'connected-to-partner', partner: socket.id, timestamp: Date.now() });
        
        // Store the connection
        activeConnections.set(socket.id, partner.id);
        activeConnections.set(partner.id, socket.id);
        
        // Notify both users they're matched
        socket.emit('partner-found', { partnerId: partner.id, isInitiator: true });
        partnerSocket.emit('partner-found', { partnerId: socket.id, isInitiator: false });
        
        // Update queue positions for remaining users
        updateQueuePositions();
        
        log('SUCCESS', 'Users matched successfully', { user1: socket.id, user2: partner.id });
      } else {
        // If partner disconnected, add current user to waiting list
        log('WARN', 'Partner disconnected while waiting', { partnerId: partner.id });
        waitingUsers.push({ id: socket.id, timestamp: Date.now() });
        userStates.set(socket.id, { state: 'waiting', timestamp: Date.now() });
        socket.emit('waiting');
        socket.emit('queue-update', { position: waitingUsers.length, total: waitingUsers.length });
      }
    } else {
      // No one waiting, add to waiting list
      waitingUsers.push({ id: socket.id, timestamp: Date.now() });
      userStates.set(socket.id, { state: 'waiting', timestamp: Date.now() });
      socket.emit('waiting');
      socket.emit('queue-update', { position: 1, total: 1 });
      log('INFO', 'User added to waiting queue', { userId: socket.id, queueLength: waitingUsers.length });
    }
  });

  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    const partnerId = activeConnections.get(socket.id);
    log('DEBUG', 'Received offer', { from: socket.id, to: partnerId });
    
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket && partnerSocket.connected) {
        io.to(partnerId).emit('offer', {
          offer: data.offer,
          from: socket.id
        });
        log('DEBUG', 'Offer forwarded', { from: socket.id, to: partnerId });
      } else {
        log('ERROR', 'Partner not connected for offer', { from: socket.id, partnerId });
        socket.emit('partner-disconnected');
      }
    } else {
      log('ERROR', 'No partner found for offer', { from: socket.id });
    }
  });

  socket.on('answer', (data) => {
    const partnerId = activeConnections.get(socket.id);
    log('DEBUG', 'Received answer', { from: socket.id, to: partnerId });
    
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket && partnerSocket.connected) {
        io.to(partnerId).emit('answer', {
          answer: data.answer,
          from: socket.id
        });
        log('DEBUG', 'Answer forwarded', { from: socket.id, to: partnerId });
      } else {
        log('ERROR', 'Partner not connected for answer', { from: socket.id, partnerId });
        socket.emit('partner-disconnected');
      }
    } else {
      log('ERROR', 'No partner found for answer', { from: socket.id });
    }
  });

  socket.on('ice-candidate', (data) => {
    const partnerId = activeConnections.get(socket.id);
    
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket && partnerSocket.connected) {
        io.to(partnerId).emit('ice-candidate', {
          candidate: data.candidate,
          from: socket.id
        });
        log('TRACE', 'ICE candidate forwarded', { from: socket.id, to: partnerId });
      }
    }
  });

  // Handle disconnect
  socket.on('disconnect-partner', () => {
    log('INFO', 'User disconnecting from partner', { userId: socket.id });
    const partnerId = activeConnections.get(socket.id);
    
    if (partnerId) {
      // Notify partner
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket && partnerSocket.connected) {
        io.to(partnerId).emit('partner-disconnected');
        log('INFO', 'Partner notified of disconnection', { userId: socket.id, partnerId });
      }
      
      // Clean up connections
      activeConnections.delete(socket.id);
      activeConnections.delete(partnerId);
      userStates.set(socket.id, { state: 'connected', timestamp: Date.now() });
      userStates.set(partnerId, { state: 'connected', timestamp: Date.now() });
    }
    
    // Remove from waiting list if present
    const wasInQueue = waitingUsers.some(user => user.id === socket.id);
    waitingUsers = waitingUsers.filter(user => user.id !== socket.id);
    if (wasInQueue) {
      updateQueuePositions();
      log('INFO', 'User removed from waiting queue', { userId: socket.id });
    }
  });

  socket.on('disconnect', () => {
    log('INFO', 'User disconnected', { userId: socket.id });
    
    // Handle partner notification
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      const partnerSocket = io.sockets.sockets.get(partnerId);
      if (partnerSocket && partnerSocket.connected) {
        io.to(partnerId).emit('partner-disconnected');
        userStates.set(partnerId, { state: 'connected', timestamp: Date.now() });
        log('INFO', 'Partner notified of sudden disconnection', { userId: socket.id, partnerId });
      }
      activeConnections.delete(partnerId);
    }
    
    // Clean up
    activeConnections.delete(socket.id);
    userStates.delete(socket.id);
    
    // Remove from waiting list and update queue
    const wasInQueue = waitingUsers.some(user => user.id === socket.id);
    waitingUsers = waitingUsers.filter(user => user.id !== socket.id);
    if (wasInQueue) {
      updateQueuePositions();
      log('INFO', 'Disconnected user removed from queue', { userId: socket.id });
    }
  });

  // Add heartbeat mechanism
  socket.on('heartbeat', () => {
    const state = userStates.get(socket.id);
    if (state) {
      state.lastHeartbeat = Date.now();
    }
  });

  // Handle reconnection attempts
  socket.on('restart-connection', (data) => {
    const partnerId = data.partnerId;
    log('INFO', 'Restart connection requested', { userId: socket.id, partnerId });
    
    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket && partnerSocket.connected) {
      // Both users still connected, restart signaling
      log('INFO', 'Restarting connection between users', { user1: socket.id, user2: partnerId });
      
      // Re-emit partner-found to restart the connection process
      socket.emit('partner-found', { partnerId: partnerId, isInitiator: true });
      partnerSocket.emit('partner-found', { partnerId: socket.id, isInitiator: false });
    } else {
      log('WARN', 'Partner not available for reconnection', { userId: socket.id, partnerId });
      socket.emit('partner-disconnected');
    }
  });
});

// Periodic cleanup of stale connections
setInterval(() => {
  const now = Date.now();
  const staleTimeout = 120000; // 2 minutes
  
  // Check for stale waiting users
  const initialQueueLength = waitingUsers.length;
  waitingUsers = waitingUsers.filter(user => {
    const socket = io.sockets.sockets.get(user.id);
    if (!socket || !socket.connected) {
      log('INFO', 'Removing stale user from queue', { userId: user.id });
      return false;
    }
    return true;
  });
  
  if (initialQueueLength !== waitingUsers.length) {
    updateQueuePositions();
  }
  
  // Check for stale connections
  for (const [userId, partnerId] of activeConnections) {
    const userSocket = io.sockets.sockets.get(userId);
    const partnerSocket = io.sockets.sockets.get(partnerId);
    
    if (!userSocket || !userSocket.connected || !partnerSocket || !partnerSocket.connected) {
      log('INFO', 'Cleaning up stale connection', { user1: userId, user2: partnerId });
      
      // Notify connected user if any
      if (userSocket && userSocket.connected) {
        userSocket.emit('partner-disconnected');
      }
      if (partnerSocket && partnerSocket.connected) {
        partnerSocket.emit('partner-disconnected');
      }
      
      activeConnections.delete(userId);
      activeConnections.delete(partnerId);
    }
  }
}, 30000); // Run every 30 seconds

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  log('INFO', `Server running on port ${PORT}`);
});
