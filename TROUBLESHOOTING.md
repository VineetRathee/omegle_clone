# Troubleshooting Guide - Omegle Clone

## Common Connection Issues and Solutions

### 1. Stuck on "Connecting..." Status

**Symptoms:**
- Connection status shows "Connecting..." but never changes to "Connected"
- Remote video doesn't appear
- Users can see each other's local video but not remote

**Solutions:**
1. **Check browser console for errors** - Press F12 and look for WebRTC errors
2. **Ensure both users have granted camera/microphone permissions**
3. **Check firewall settings** - WebRTC requires UDP ports to be open
4. **Try using a different browser** - Chrome and Firefox have best WebRTC support

### 2. Remote Video Not Visible

**Symptoms:**
- Connection shows as successful but remote video is black
- Only one user can see the other

**Solutions:**
1. **Check ICE candidate exchange** - Look for "ICE candidate" logs in console
2. **Verify STUN servers are accessible** - Corporate networks may block them
3. **Test with both users on same network first**
4. **Check if video autoplay is blocked** - Click on the video area

### 3. Frequent Disconnections

**Symptoms:**
- Connection drops after a few seconds/minutes
- "Partner disconnected" appears unexpectedly

**Solutions:**
1. **Check network stability** - Run a speed test
2. **Monitor server logs** for disconnect reasons
3. **Increase ping timeout in server config if needed**

## Testing the Application

### Using the Test Tool

1. Open `test-connection.html` in your browser
2. Click "Open New Client" to test individual connections
3. Click "Test 5 Clients" to test the queue system

### Manual Testing Steps

1. **Test Queue System:**
   - Open 5 browser windows/tabs
   - Start video chat in each
   - Verify that:
     - First 2 connect immediately
     - 3rd user sees queue position 1/1
     - 4th user sees queue position 2/2
     - 5th user sees queue position 3/3
     - When someone disconnects, queue updates

2. **Test Connection Reliability:**
   - Connect 2 users
   - Wait for "Connected" status
   - Verify both can see/hear each other
   - Test disconnect/reconnect

### Server Logs

The server now includes comprehensive logging:

```
[timestamp] [INFO] New user connected {userId: "..."}
[timestamp] [INFO] User looking for partner {userId: "..."}
[timestamp] [SUCCESS] Users matched successfully {user1: "...", user2: "..."}
[timestamp] [DEBUG] Offer forwarded {from: "...", to: "..."}
[timestamp] [DEBUG] Answer forwarded {from: "...", to: "..."}
[timestamp] [INFO] Connection state changed {state: "connected"}
```

### Client Logs

Enable verbose logging in browser console:

```javascript
// In browser console
localStorage.debug = '*';
```

## Network Requirements

### Ports and Protocols
- **HTTP/HTTPS:** Port 3000 (or configured PORT)
- **WebSocket:** Same as HTTP/HTTPS port
- **WebRTC Media:** UDP ports (dynamically allocated)
- **STUN:** UDP port 19302 (Google STUN servers)

### Firewall Configuration
Ensure these are allowed:
- Outbound UDP to STUN servers
- WebSocket connections to your server
- UDP peer-to-peer connections

## Performance Optimization

### Server Configuration
```javascript
// Adjust in server.js if needed
const io = socketIO(server, {
  pingTimeout: 60000,      // Increase for unstable connections
  pingInterval: 25000,     // How often to ping clients
  transports: ['websocket', 'polling'] // Add polling as fallback
});
```

### Client Configuration
```javascript
// Adjust in script.js if needed
const iceServers = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Add TURN server for better connectivity
    // { urls: 'turn:your-turn-server.com', username: '...', credential: '...' }
  ]
};
```

## Debugging Checklist

- [ ] Both users have camera/microphone permissions granted
- [ ] Server is running and accessible
- [ ] No firewall blocking WebSocket or UDP traffic
- [ ] Browser console shows successful ICE candidate exchange
- [ ] Connection state reaches "connected"
- [ ] No CORS errors in console
- [ ] Server logs show proper user matching

## Getting Help

If issues persist:
1. Check server logs for error patterns
2. Save browser console logs from both users
3. Note the exact sequence of actions that cause the issue
4. Test with different browsers/networks to isolate the problem
