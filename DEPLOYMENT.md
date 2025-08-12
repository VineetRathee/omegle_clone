# Deployment Guide - Making Your Omegle Clone Live

## Option 1: Deploy to Render (Free Tier Available)

### Steps:
1. Create a free account at [render.com](https://render.com)

2. Push your code to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

3. On Render:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - Name: `omegle-clone`
     - Environment: `Node`
     - Build Command: `npm install`
     - Start Command: `npm start`
   - Click "Create Web Service"

4. Your app will be live at: `https://your-app-name.onrender.com`

## Option 2: Deploy to Railway (Simple & Fast)

### Steps:
1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Deploy:
```bash
railway login
railway init
railway up
```

3. Get your live URL:
```bash
railway open
```

## Option 3: Deploy to Heroku (Paid Plans Only)

### Prerequisites:
- Heroku account (paid plan required)
- Heroku CLI installed

### Create Procfile:
```
web: node server.js
```

### Deploy:
```bash
heroku create your-app-name
git add .
git commit -m "Add Heroku deployment"
git push heroku main
heroku open
```

## Option 4: Deploy to Vercel (For Frontend + Serverless)

Note: Requires converting to serverless architecture.

## Option 5: Deploy to a VPS (DigitalOcean, AWS, etc.)

### Using DigitalOcean:
1. Create a Droplet (Ubuntu 22.04)
2. SSH into your server
3. Install Node.js:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

4. Clone and run your app:
```bash
git clone YOUR_REPO_URL
cd clone
npm install
npm install -g pm2
pm2 start server.js
pm2 startup
pm2 save
```

5. Setup Nginx reverse proxy:
```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/default
```

Add:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

6. Restart Nginx:
```bash
sudo systemctl restart nginx
```

## Important Considerations for Production

### 1. HTTPS is Required
WebRTC requires HTTPS in production. Most platforms above provide free SSL certificates.

### 2. Update Your Code for Production

Add to `server.js`:
```javascript
const PORT = process.env.PORT || 3000;
```

### 3. Add TURN Servers
For better connectivity through firewalls, add TURN servers to `script.js`:
```javascript
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        // Add TURN server (you can use free ones or set up your own)
        {
            urls: 'turn:numb.viagenie.ca',
            credential: 'muazkh',
            username: 'webrtc@live.com'
        }
    ]
};
```

### 4. Environment Variables
Create `.env` file for sensitive data:
```
NODE_ENV=production
PORT=3000
```

### 5. Security Enhancements
- Add rate limiting
- Implement content moderation
- Add user reporting features
- Use helmet.js for security headers

## Quick Start with Ngrok (Temporary Solution)

For quick testing without deployment:

1. Install ngrok:
```bash
npm install -g ngrok
```

2. Keep your server running locally

3. In a new terminal:
```bash
ngrok http 3000
```

4. Share the HTTPS URL provided by ngrok

Note: Ngrok URLs are temporary and change each time.

## Recommended: Start with Render

For beginners, I recommend Render because:
- Free tier available
- Automatic HTTPS
- Easy GitHub integration
- No credit card required
- Good for WebRTC apps

After deployment, update your README with the live URL!
