# Omegle Clone - Video Chat Application

A simple video chat application that connects random strangers for video conversations, similar to Omegle. Built using WebRTC for peer-to-peer video communication and Socket.io for signaling.

## Features

- **Random Video Chat**: Connect with random strangers for video conversations
- **No Login Required**: Start chatting instantly without any registration
- **WebRTC P2P**: Direct peer-to-peer video/audio communication
- **Simple UI**: Clean and intuitive interface similar to Omegle
- **Next/Disconnect**: Easy controls to disconnect and find new partners

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript
- **Backend**: Node.js, Express.js
- **Real-time Communication**: Socket.io
- **Video/Audio**: WebRTC
- **STUN Servers**: Google's public STUN servers

## Installation

1. Clone the repository:
```bash
cd /Users/Vineet.Rathee_1/Desktop/clone
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

## How to Use

1. Click "Start Video Chat" on the welcome screen
2. Allow camera and microphone permissions when prompted
3. Wait to be connected with a random stranger
4. Use "Disconnect" to end the current chat
5. Use "Next" to find a new partner without returning to the home screen

## Project Structure

```
clone/
├── server.js           # Express server with Socket.io
├── package.json        # Node.js dependencies
├── public/
│   ├── index.html     # Main HTML file
│   ├── styles.css     # CSS styles
│   └── script.js      # Client-side JavaScript with WebRTC logic
```

## Security Notes

- This is a basic implementation for demonstration purposes
- In production, consider adding:
  - HTTPS for secure connections
  - TURN servers for better connectivity through firewalls
  - Content moderation features
  - Rate limiting and abuse prevention
  - User reporting mechanisms

## Browser Compatibility

Works best on modern browsers that support WebRTC:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

## Development

For development with auto-restart:
```bash
npm run dev
```

## License

This project is open source and available for educational purposes.
