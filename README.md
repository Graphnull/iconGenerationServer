# 🎨 Icon Generation Server

![Node](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express)
![Ollama](https://img.shields.io/badge/Ollama-AI-FF6B35?style=flat-square&logo=ollama)

> Express-based API server for generating icons using Ollama AI with automatic color customization and transparent background support.

## ✨ Features

- 🎨 **AI-Powered** — Generate icons using Ollama (flux2-klein model)
- 🎨 **Custom Colors** — Apply any hex color to generated icons
- 🗄️ **Smart Caching** — MD5-based cache for instant retrieval
- ✂️ **Auto-Processing** — Greyscale, contrast, crop, resize to 256×256
- 🔮 **Transparent BG** — Icons have no background (alpha channel)

## 📁 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Icon Generation Flow                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Request ──▶  ┌─────────┐                                  │
│   {prompt,     │  Cache  │──▶ Return cached icon            │
│    color}      │  Check  │                                  │
│                └────┬────┘                                  │
│                     │ cache miss                            │
│                     ▼                                       │
│                ┌─────────┐     ┌────────────┐               │
│                │ Ollama  │────▶│  Generated │               │
│                │  AI     │     │  PNG 1024x │               │
│                └─────────┘     └──────┬─────┘               │
│                                        │                    │
│                                        ▼                    │
│                                  ┌────────────┐             │
│                                  │  Process   │             │
│                                  │ • Greyscale│             │
│                                  │ • Contrast │             │
│                                  │ • Crop     │             │
│                                  │ • Resize   │             │
│                                  └──────┬─────┘             │
│                                        │                    │
│                                        ▼                    │
│                                  ┌────────────┐             │
│                                  │   Color &  │             │
│                                  │ Transparent│             │
│                                  │   BG       │             │
│                                  └──────┬─────┘             │
│                                        │                    │
│                                        ▼                    │
│                                  ┌────────────┐             │
│                                  │   Cache    │             │
│                                  │   Save     │             │
│                                  └──────┬─────┘             │
│                                        │                    │
│                                        ▼                    │
│                                   Base64 PNG                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Requirements

| Software | Version | Install |
|----------|---------|---------|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **Ollama** | latest | [ollama.com](https://ollama.com) |
| **Model** | x/flux2-klein:4b | `ollama pull x/flux2-klein:4b` |

### Quick Setup

```bash
# Install Ollama (macOS)
brew install ollama

# Install Ollama (Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Pull AI model
ollama pull x/flux2-klein:4b

# Install dependencies
npm install

# Build TypeScript
npm run build
```

## 🚀 Quick Start

```bash
# Development with hot-reload
npm run dev

# Production
npm start

# Or use PM2
pm2 start ecosystem.config.js
```

Server runs on **port 3000** by default. Change with: `PORT=8080 npm start`

## 📡 API Endpoints

### `POST /icon` — Generate Icon

**Request:**
```json
{
  "prompt": "neon star",
  "color": "#FF0055"
}
```

**Response:**
```json
{
  "success": true,
  "cacheKey": "a1b2c3d4e5f6...",
  "image": "data:image/png;base64,..."
}
```

### `GET /health` — Health Check

```json
{
  "status": "ok",
  "timestamp": "2026-06-21T16:30:00.000Z"
}
```

### `GET /icons` — List Cached Icons

```json
{
  "count": 5,
  "files": ["a1b2c3d4.png", "e5f6g7h8.png"]
}
```

## 💡 Usage Examples

### cURL

```bash
# 🔴 Red robot
curl -X POST http://localhost:3000/icon \
  -H "Content-Type: application/json" \
  -d '{"prompt": "robot head", "color": "#FF0000"}'

# 🔵 Blue star
curl -X POST http://localhost:3000/icon \
  -H "Content-Type: application/json" \
  -d '{"prompt": "star", "color": "#3498db"}'

# 🟢 Green turtle
curl -X POST http://localhost:3000/icon \
  -H "Content-Type: application/json" \
  -d '{"prompt": "turtle", "color": "#27ae60"}'
```

### JavaScript / Fetch

```javascript
const generateIcon = async (prompt, color) => {
  const response = await fetch('http://localhost:3000/icon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, color })
  });
  
  const { success, cacheKey, image } = await response.json();
  
  if (success) {
    // Display in <img> tag
    document.querySelector('#icon').src = image;
    
    // Download
    const link = document.createElement('a');
    link.download = `${cacheKey}.png`;
    link.href = image;
    link.click();
  }
};

generateIcon('neon star', '#FF0055');
```

### Python

```python
import requests
import base64

response = requests.post('http://localhost:3000/icon', json={
    'prompt': 'neon star',
    'color': '#FF0055'
})

data = response.json()
if data['success']:
    img_data = base64.b64decode(data['image'].split(',')[1])
    with open('icon.png', 'wb') as f:
        f.write(img_data)
```

## 🎯 How It Works

```
1. Cache Check  ──▶  MD5(prompt:color) ──▶  Return cached if exists

2. Ollama Generate:
   ollama run x/flux2-klein:4b '{"icon":true,"style":"minimalistic","info":"..."}'

3. Process Pipeline:
   ┌──────────┐   ┌──────────┐   ┌───────┐   ┌────────┐
   │ Greyscale│──▶│ Contrast │──▶│ Crop  │──▶│ Resize │
   └──────────┘   └──────────┘   └───┬───┘   │ 256²   │
                                     │       └────────┘
                                     ▼
4. Color & Transparency:
   • Bright pixels (>230)  ──▶  Alpha = 0 (transparent)
   • Dark pixels           ──▶  Apply color, Alpha = 255

5. Cache ──▶  Return Base64 PNG
```

## 📂 Project Structure

```
iconGenerationServer/
├── src/
│   ├── server.ts        # Express server & API endpoints
│   ├── processImage.ts  # Image processing (greyscale, contrast, crop, resize)
│   └── const.ts         # Constants (WIDTH, HEIGHT)
├── icons/               # Icon cache directory (PNG files)
├── dist/                # Compiled JavaScript
├── ecosystem.config.js  # PM2 configuration
├── package.json
└── tsconfig.json
```

## 📜 License

[Apache License 2.0](LICENSE)