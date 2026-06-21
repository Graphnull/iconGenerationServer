import express, { Request, Response } from 'express';
import { Jimp } from 'jimp';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { processImage } from './processImage';

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;
const ICONS_DIR = path.join(__dirname, '..', 'icons');

// Threshold for background detection (brightness > this = transparent)
const BG_THRESHOLD = 230;

app.use(express.json());

interface IconRequest {
  prompt: string;
  color: string;
}

/**
 * Generate a hash from prompt and color for caching
 */
function generateCacheKey(prompt: string, color: string): string {
  const data = `${prompt}:${color}`;
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Ensure icons directory exists
 */
function ensureIconsDir(): void {
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }
}

/**
 * Generate icon using Ollama
 */
async function generateIconWithOllama(prompt: string): Promise<string> {
  const payload = JSON.stringify({
    icon: true,
    style: "minimalistic",
    info: prompt
  });
  
  const command = `ollama run x/flux2-klein:4b '${payload}'`;
  
  try {
    const { stdout, stderr } = await execAsync(command, { timeout: 120000 });
    
    // Parse output for "Image saved to: {filename}"
    const match = stdout.match(/Image saved to:\s*(.+)/);
    if (match && match[1]) {
      return match[1].trim();
    }
    
    // Also check stderr
    const stderrMatch = stderr.match(/Image saved to:\s*(.+)/);
    if (stderrMatch && stderrMatch[1]) {
      return stderrMatch[1].trim();
    }
    
    throw new Error(`Failed to parse Ollama output: ${stdout} ${stderr}`);
  } catch (error) {
    throw new Error(`Ollama generation failed: ${error}`);
  }
}

/**
 * Process greyscale image to add color and transparency
 * - White/bright pixels become fully transparent
 * - Dark pixels get the target color
 * - Alpha channel is properly set
 */
async function processWithColorAndTransparency(
  imageBuffer: Buffer, 
  hexColor: string
): Promise<Buffer> {
  const image = await Jimp.fromBuffer(imageBuffer);
  const { width, height } = image;
  
  // Parse hex color to RGB (0-255)
  const color = hexColor.replace('#', '');
  const targetR = parseInt(color.substring(0, 2), 16);
  const targetG = parseInt(color.substring(2, 4), 16);
  const targetB = parseInt(color.substring(4, 6), 16);
  
  // First pass: apply color based on luminance, mark transparent pixels
  image.scan(0, 0, width, height, function(this: { bitmap: { data: Buffer } }, x: number, y: number, idx: number) {
    // Get pixel brightness (since greyscale, R=G=B)
    const brightness = this.bitmap.data[idx] / 255;
    
    if (brightness > BG_THRESHOLD / 255) {
      // Background: make fully transparent
      this.bitmap.data[idx + 0] = 0;
      this.bitmap.data[idx + 1] = 0;
      this.bitmap.data[idx + 2] = 0;
      this.bitmap.data[idx + 3] = 0; // Alpha = 0 (transparent)
    } else {
      // Content: apply color based on darkness
      // Darker pixels (lower brightness) get more color intensity
      const colorIntensity = Math.pow(1 - brightness, 1.5); // Non-linear for better results
      
      // Apply color
      this.bitmap.data[idx + 0] = Math.round(targetR * colorIntensity);
      this.bitmap.data[idx + 1] = Math.round(targetG * colorIntensity);
      this.bitmap.data[idx + 2] = Math.round(targetB * colorIntensity);
      this.bitmap.data[idx + 3] = 255; // Alpha = 255 (opaque)
    }
  });
  
  return image.getBuffer('image/png');
}

app.post('/icon', async (req: Request, res: Response) => {
  try {
    const { prompt, color } = req.body as IconRequest;
    
    if (!prompt || !color) {
      return res.status(400).json({ 
        error: 'Missing required fields: prompt and color are required' 
      });
    }
    
    // Validate color format (hex)
    const hexColor = color.startsWith('#') ? color : `#${color}`;
    if (!/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
      return res.status(400).json({ 
        error: 'Invalid color format. Use hex format like #FF0000 or FF0000' 
      });
    }
    
    ensureIconsDir();
    
    // Generate cache key
    const cacheKey = generateCacheKey(prompt, color);
    const cachedPath = path.join(ICONS_DIR, `${cacheKey}.png`);
    
    let imageBuffer: Buffer;
    
    // Check cache
    if (fs.existsSync(cachedPath)) {
      imageBuffer = fs.readFileSync(cachedPath);
    } else {
      // Generate with Ollama
      const generatedPath = await generateIconWithOllama(prompt);
      
      // Read generated image
      const generatedImage = fs.readFileSync(generatedPath);
      
      // Process image (greyscale, contrast, crop, resize)
      const processedBuffer = await processImage(generatedImage);
      
      // Apply color with transparency
      imageBuffer = await processWithColorAndTransparency(processedBuffer, hexColor);
      
      // Save to cache
      fs.writeFileSync(cachedPath, imageBuffer);
      
      // Clean up generated file
      try {
        fs.unlinkSync(generatedPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    
    // Return image as base64
    const base64Image = imageBuffer.toString('base64');
    
    res.json({
      success: true,
      cacheKey,
      image: `data:image/png;base64,${base64Image}`
    });
    
  } catch (error) {
    console.error('Error generating icon:', error);
    res.status(500).json({ 
      error: 'Failed to generate icon',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/icons', (_req: Request, res: Response) => {
  ensureIconsDir();
  const files = fs.readdirSync(ICONS_DIR).filter(f => f.endsWith('.png'));
  res.json({ count: files.length, files });
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Icon generation server running on port ${PORT}`);
  ensureIconsDir();
});

export default server;