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
 * Recolor image by applying solid color with proper intensity
 * Dark pixels get the full color, light pixels stay lighter
 */
async function recolorImage(imageBuffer: Buffer, hexColor: string): Promise<Buffer> {
  const image = await Jimp.fromBuffer(imageBuffer);
  
  // Get image dimensions
  const width = image.width;
  const height = image.height;
  
  // Parse hex color to RGB
  const color = hexColor.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  
  // Apply color tint: darker areas get more color, lighter areas get less
  image.scan(0, 0, width, height, function(this: { bitmap: { data: Buffer } }, x: number, y: number, idx: number) {
    // Get current pixel brightness (since greyscale, R=G=B)
    const brightness = this.bitmap.data[idx] / 255;
    
    // Invert: dark pixels (low brightness) should get more color
    const colorIntensity = (1 - brightness);
    
    // Apply color with intensity (stronger effect on dark pixels)
    // For white backgrounds, this means only the content gets colored
    this.bitmap.data[idx + 0] = Math.round(r * colorIntensity + this.bitmap.data[idx + 0] * (1 - colorIntensity));
    this.bitmap.data[idx + 1] = Math.round(g * colorIntensity + this.bitmap.data[idx + 1] * (1 - colorIntensity));
    this.bitmap.data[idx + 2] = Math.round(b * colorIntensity + this.bitmap.data[idx + 2] * (1 - colorIntensity));
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
      console.log(`Cache hit for key: ${cacheKey}`);
      imageBuffer = fs.readFileSync(cachedPath);
    } else {
      console.log(`Cache miss for key: ${cacheKey}, generating...`);
      
      // Generate with Ollama
      const generatedPath = await generateIconWithOllama(prompt);
      console.log(`Generated image at: ${generatedPath}`);
      
      // Read generated image
      const generatedImage = fs.readFileSync(generatedPath);
      
      // Process image (greyscale, contrast, crop, resize)
      const processedBuffer = await processImage(generatedImage);
      
      // Recolor the image with the user's color
      const recoloredBuffer = await recolorImage(processedBuffer, hexColor);
      
      // Save to cache
      fs.writeFileSync(cachedPath, recoloredBuffer);
      console.log(`Cached image at: ${cachedPath}`);
      
      imageBuffer = recoloredBuffer;
      
      // Clean up generated file (keep only cached)
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