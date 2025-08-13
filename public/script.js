// Lazy load Socket.io connection
let socket = null;
let socketLoaded = false;

// Initialize socket connection only when needed
function initializeSocket() {
    if (socketLoaded) return;
    
    const SOCKET_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000' 
        : window.location.origin;

    socket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
    });
    
    socketLoaded = true;
    setupSocketListeners();
}

// DOM elements
const welcomeScreen = document.getElementById('welcome-screen');
const waitingScreen = document.getElementById('waiting-screen');
const chatScreen = document.getElementById('chat-screen');
const startBtn = document.getElementById('start-btn');
const cancelBtn = document.getElementById('cancel-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const nextBtn = document.getElementById('next-btn');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const statusText = document.getElementById('status-text');

// WebRTC variables
let localStream = null;
let peerConnection = null;
let currentPartner = null;
let connectionState = 'idle';
let reconnectTimer = null;
let iceCandidateQueue = [];

// Logging function
function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage, data);
}

// ICE servers configuration
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ]
};

// Show/hide screens
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
}

// Initialize media devices
async function initializeMedia() {
    try {
        log('INFO', 'Requesting media permissions');
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user'
            },
            audio: true
        });
        localStream = stream;
        localVideo.srcObject = stream;
        log('SUCCESS', 'Media devices initialized');
        return true;
    } catch (error) {
        log('ERROR', 'Failed to access media devices', { error: error.message });
        if (error.name === 'NotAllowedError') {
            alert('Camera/Microphone access denied. Please allow permissions and try again.');
        } else if (error.name === 'NotFoundError') {
            alert('No camera or microphone found. Please connect a device and try again.');
        } else {
            alert('Unable to access camera/microphone. Error: ' + error.message);
        }
        return false;
    }
}

// Create peer connection
function createPeerConnection() {
    try {
        log('INFO', 'Creating peer connection');
        peerConnection = new RTCPeerConnection(iceServers);

        // Add local stream tracks to peer connection
        if (localStream) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
                log('DEBUG', 'Added local track', { kind: track.kind });
            });
        } else {
            log('WARN', 'No local stream available when creating peer connection');
        }

        // Handle incoming stream
        peerConnection.ontrack = (event) => {
            log('INFO', 'Received remote stream', { streamId: event.streams[0].id });
            remoteVideo.srcObject = event.streams[0];
            
            // Ensure video plays
            remoteVideo.play().catch(e => {
                log('WARN', 'Auto-play failed, user interaction may be required', { error: e.message });
            });
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                if (peerConnection.remoteDescription) {
                    socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        to: currentPartner
                    });
                } else {
                    // Queue ICE candidates if remote description not set yet
                    iceCandidateQueue.push(event.candidate);
                    log('DEBUG', 'Queuing ICE candidate');
                }
            }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            const state = peerConnection.connectionState;
            log('INFO', 'Connection state changed', { state });
            updateConnectionStatus(state);
            
            if (state === 'failed') {
                handleConnectionFailure();
            }
        };

        // Handle ICE connection state changes
        peerConnection.oniceconnectionstatechange = () => {
            log('DEBUG', 'ICE connection state', { state: peerConnection.iceConnectionState });
        };

        // Handle ICE gathering state changes
        peerConnection.onicegatheringstatechange = () => {
            log('DEBUG', 'ICE gathering state', { state: peerConnection.iceGatheringState });
        };

        return peerConnection;
    } catch (error) {
        log('ERROR', 'Failed to create peer connection', { error: error.message });
        alert('Failed to establish connection. Please try again.');
        return null;
    }
}

// Update connection status display
function updateConnectionStatus(state) {
    connectionState = state;
    switch (state) {
        case 'connected':
            statusText.textContent = 'Connected';
            statusText.style.color = '#28a745';
            break;
        case 'connecting':
            statusText.textContent = 'Connecting...';
            statusText.style.color = '#ffc107';
            break;
        case 'failed':
        case 'disconnected':
            statusText.textContent = 'Disconnected';
            statusText.style.color = '#dc3545';
            break;
    }
}

// Handle connection failure
function handleConnectionFailure() {
    log('ERROR', 'Connection failed, attempting to reconnect');
    
    if (currentPartner && !reconnectTimer) {
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            if (peerConnection && peerConnection.connectionState === 'failed') {
                log('INFO', 'Attempting reconnection');
                // Close the failed connection
                peerConnection.close();
                // Create new connection and restart
                createPeerConnection();
                // Notify server to restart signaling
                socket.emit('restart-connection', { partnerId: currentPartner });
            }
        }, 3000);
    }
}

// Process queued ICE candidates
async function processIceCandidateQueue() {
    if (iceCandidateQueue.length > 0 && peerConnection && peerConnection.remoteDescription) {
        log('INFO', 'Processing queued ICE candidates', { count: iceCandidateQueue.length });
        
        for (const candidate of iceCandidateQueue) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                log('DEBUG', 'Added queued ICE candidate');
            } catch (error) {
                log('ERROR', 'Failed to add queued ICE candidate', { error: error.message });
            }
        }
        iceCandidateQueue = [];
    }
}

// Clean up peer connection
function cleanupConnection() {
    log('INFO', 'Cleaning up connection');
    
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    
    remoteVideo.srcObject = null;
    currentPartner = null;
    connectionState = 'idle';
    iceCandidateQueue = [];
}

// Event Listeners
startBtn.addEventListener('click', async () => {
    // Initialize socket connection on first user interaction
    if (!socketLoaded) {
        initializeSocket();
    }
    
    const mediaInitialized = await initializeMedia();
    if (mediaInitialized) {
        showScreen(waitingScreen);
        socket.emit('find-partner');
    }
});

cancelBtn.addEventListener('click', () => {
    if (socket) socket.emit('disconnect-partner');
    showScreen(welcomeScreen);
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        localVideo.srcObject = null;
    }
});

disconnectBtn.addEventListener('click', () => {
    if (socket) socket.emit('disconnect-partner');
    cleanupConnection();
    showScreen(welcomeScreen);
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        localVideo.srcObject = null;
    }
});

nextBtn.addEventListener('click', () => {
    if (socket) {
        socket.emit('disconnect-partner');
        cleanupConnection();
        showScreen(waitingScreen);
        socket.emit('find-partner');
    }
});

// Setup socket event listeners
function setupSocketListeners() {
    socket.on('connect', () => {
        log('INFO', 'Connected to server');
    });

    socket.on('disconnect', () => {
        log('WARN', 'Disconnected from server');
    });

    socket.on('connection-confirmed', (data) => {
        log('INFO', 'Connection confirmed', { userId: data.userId });
    });

    socket.on('waiting', () => {
        log('INFO', 'Waiting for partner');
        document.getElementById('queue-info').style.display = 'none';
    });

    socket.on('queue-update', (data) => {
        log('INFO', 'Queue position updated', data);
        document.getElementById('queue-position').textContent = data.position;
        document.getElementById('queue-total').textContent = data.total;
        document.getElementById('queue-info').style.display = 'block';
    });

    socket.on('partner-found', async (data) => {
    log('SUCCESS', 'Partner found', { partnerId: data.partnerId, isInitiator: data.isInitiator });
    currentPartner = data.partnerId;
    showScreen(chatScreen);
    
    // Reset connection state
    iceCandidateQueue = [];
    connectionState = 'connecting';
    
    // Create peer connection
    const pc = createPeerConnection();
    if (!pc) {
        log('ERROR', 'Failed to create peer connection');
        socket.emit('disconnect-partner');
        showScreen(welcomeScreen);
        return;
    }
    
    // If initiator, create and send offer
    if (data.isInitiator) {
        try {
            log('INFO', 'Creating offer as initiator');
            const offer = await peerConnection.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await peerConnection.setLocalDescription(offer);
            socket.emit('offer', {
                offer: offer,
                to: currentPartner
            });
            log('DEBUG', 'Offer sent to partner');
        } catch (error) {
            log('ERROR', 'Failed to create offer', { error: error.message });
            alert('Failed to initiate connection. Please try again.');
            socket.emit('disconnect-partner');
            showScreen(welcomeScreen);
        }
    }
});

socket.on('offer', async (data) => {
    log('INFO', 'Received offer', { from: data.from });
    
    if (!peerConnection) {
        log('WARN', 'No peer connection exists, creating new one');
        const pc = createPeerConnection();
        if (!pc) {
            log('ERROR', 'Failed to create peer connection for offer');
            return;
        }
    }
    
    try {
        log('DEBUG', 'Setting remote description from offer');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        
        // Process any queued ICE candidates
        await processIceCandidateQueue();
        
        log('INFO', 'Creating answer');
        const answer = await peerConnection.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });
        
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('answer', {
            answer: answer,
            to: data.from
        });
        log('DEBUG', 'Answer sent');
    } catch (error) {
        log('ERROR', 'Failed to handle offer', { error: error.message });
        alert('Connection failed. Please try again.');
        socket.emit('disconnect-partner');
        cleanupConnection();
        showScreen(welcomeScreen);
    }
});

socket.on('answer', async (data) => {
    log('INFO', 'Received answer', { from: data.from });
    
    if (!peerConnection) {
        log('ERROR', 'No peer connection exists for answer');
        return;
    }
    
    try {
        log('DEBUG', 'Setting remote description from answer');
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        
        // Process any queued ICE candidates
        await processIceCandidateQueue();
        
        log('DEBUG', 'Answer processed successfully');
    } catch (error) {
        log('ERROR', 'Failed to handle answer', { error: error.message });
        alert('Connection failed. Please try again.');
        socket.emit('disconnect-partner');
        cleanupConnection();
        showScreen(welcomeScreen);
    }
});

socket.on('ice-candidate', async (data) => {
    log('DEBUG', 'Received ICE candidate', { from: data.from });
    
    if (!peerConnection) {
        log('WARN', 'No peer connection for ICE candidate');
        return;
    }
    
    try {
        if (peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            log('TRACE', 'ICE candidate added');
        } else {
            // Queue the candidate if remote description not set yet
            iceCandidateQueue.push(data.candidate);
            log('DEBUG', 'ICE candidate queued (no remote description yet)');
        }
    } catch (error) {
        log('ERROR', 'Failed to add ICE candidate', { error: error.message });
    }
});

    socket.on('partner-disconnected', () => {
        log('INFO', 'Partner disconnected');
        cleanupConnection();
        alert('Your partner has disconnected.');
        showScreen(welcomeScreen);
    });

    // Add heartbeat to maintain connection
    setInterval(() => {
        if (socket && socket.connected) {
            socket.emit('heartbeat');
        }
    }, 30000);
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (currentPartner && socket) {
        socket.emit('disconnect-partner');
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
});
