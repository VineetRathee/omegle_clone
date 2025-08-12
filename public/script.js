// Socket.io connection
const socket = io();

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
        return true;
    } catch (error) {
        console.error('Error accessing media devices:', error);
        alert('Unable to access camera/microphone. Please ensure you have granted permissions.');
        return false;
    }
}

// Create peer connection
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(iceServers);

    // Add local stream tracks to peer connection
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // Handle incoming stream
    peerConnection.ontrack = (event) => {
        console.log('Received remote stream');
        remoteVideo.srcObject = event.streams[0];
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                candidate: event.candidate,
                to: currentPartner
            });
        }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        updateConnectionStatus(peerConnection.connectionState);
    };

    return peerConnection;
}

// Update connection status display
function updateConnectionStatus(state) {
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

// Clean up peer connection
function cleanupConnection() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    remoteVideo.srcObject = null;
    currentPartner = null;
}

// Event Listeners
startBtn.addEventListener('click', async () => {
    const mediaInitialized = await initializeMedia();
    if (mediaInitialized) {
        showScreen(waitingScreen);
        socket.emit('find-partner');
    }
});

cancelBtn.addEventListener('click', () => {
    socket.emit('disconnect-partner');
    showScreen(welcomeScreen);
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        localVideo.srcObject = null;
    }
});

disconnectBtn.addEventListener('click', () => {
    socket.emit('disconnect-partner');
    cleanupConnection();
    showScreen(welcomeScreen);
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
        localVideo.srcObject = null;
    }
});

nextBtn.addEventListener('click', () => {
    socket.emit('disconnect-partner');
    cleanupConnection();
    showScreen(waitingScreen);
    socket.emit('find-partner');
});

// Socket event listeners
socket.on('waiting', () => {
    console.log('Waiting for partner...');
});

socket.on('partner-found', async (data) => {
    console.log('Partner found:', data);
    currentPartner = data.partnerId;
    showScreen(chatScreen);
    
    // Create peer connection
    createPeerConnection();
    
    // If initiator, create and send offer
    if (data.isInitiator) {
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('offer', {
                offer: offer,
                to: currentPartner
            });
        } catch (error) {
            console.error('Error creating offer:', error);
        }
    }
});

socket.on('offer', async (data) => {
    console.log('Received offer from:', data.from);
    if (!peerConnection) {
        createPeerConnection();
    }
    
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('answer', {
            answer: answer,
            to: data.from
        });
    } catch (error) {
        console.error('Error handling offer:', error);
    }
});

socket.on('answer', async (data) => {
    console.log('Received answer from:', data.from);
    try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
        console.error('Error handling answer:', error);
    }
});

socket.on('ice-candidate', async (data) => {
    console.log('Received ICE candidate from:', data.from);
    try {
        if (peerConnection && peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
    } catch (error) {
        console.error('Error adding ICE candidate:', error);
    }
});

socket.on('partner-disconnected', () => {
    console.log('Partner disconnected');
    cleanupConnection();
    alert('Your partner has disconnected.');
    showScreen(welcomeScreen);
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (currentPartner) {
        socket.emit('disconnect-partner');
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
});
