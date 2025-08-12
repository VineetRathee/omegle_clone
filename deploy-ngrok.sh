#!/bin/bash

echo "🚀 Quick Deploy with Ngrok"
echo "========================="
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed."
    echo "📦 Installing ngrok..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install ngrok/ngrok/ngrok
    else
        # Linux/Other
        curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
        echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list
        sudo apt update && sudo apt install ngrok
    fi
fi

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "⚠️  Server is not running. Starting server..."
    npm start &
    sleep 3
fi

echo "✅ Server is running on http://localhost:3000"
echo ""
echo "🌐 Creating public tunnel with ngrok..."
echo ""

# Start ngrok
ngrok http 3000
