const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.static('public'));

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Store waiting users
let waitingUsers = [];
// Store active connections
const activeConnections = new Map();

io.on('connection', (socket) => {
  console.log('New user connected:', socket.id);

  // Handle user looking for a partner
  socket.on('find-partner', () => {
    // Check if there's someone waiting
    if (waitingUsers.length > 0) {
      // Get the first waiting user
      const partnerId = waitingUsers.shift();
      const partnerSocket = io.sockets.sockets.get(partnerId);
      
      if (partnerSocket && partnerSocket.connected) {
        // Create a room for both users
        const roomId = `${socket.id}-${partnerId}`;
        
        // Store the connection
        activeConnections.set(socket.id, partnerId);
        activeConnections.set(partnerId, socket.id);
        
        // Notify both users they're matched
        socket.emit('partner-found', { partnerId, isInitiator: true });
        partnerSocket.emit('partner-found', { partnerId: socket.id, isInitiator: false });
        
        console.log(`Matched ${socket.id} with ${partnerId}`);
      } else {
        // If partner disconnected, add current user to waiting list
        waitingUsers.push(socket.id);
        socket.emit('waiting');
      }
    } else {
      // No one waiting, add to waiting list
      waitingUsers.push(socket.id);
      socket.emit('waiting');
      console.log(`User ${socket.id} is waiting for a partner`);
    }
  });

  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('offer', {
        offer: data.offer,
        from: socket.id
      });
    }
  });

  socket.on('answer', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('answer', {
        answer: data.answer,
        from: socket.id
      });
    }
  });

  socket.on('ice-candidate', (data) => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('ice-candidate', {
        candidate: data.candidate,
        from: socket.id
      });
    }
  });

  // Handle disconnect
  socket.on('disconnect-partner', () => {
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      // Notify partner
      io.to(partnerId).emit('partner-disconnected');
      
      // Clean up connections
      activeConnections.delete(socket.id);
      activeConnections.delete(partnerId);
    }
    
    // Remove from waiting list if present
    waitingUsers = waitingUsers.filter(id => id !== socket.id);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Handle partner notification
    const partnerId = activeConnections.get(socket.id);
    if (partnerId) {
      io.to(partnerId).emit('partner-disconnected');
      activeConnections.delete(partnerId);
    }
    
    // Clean up
    activeConnections.delete(socket.id);
    waitingUsers = waitingUsers.filter(id => id !== socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
