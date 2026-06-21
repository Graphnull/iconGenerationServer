import { Jimp } from 'jimp'
import { HEIGHT, WIDTH } from './const';

export async function processImage(img: Buffer): Promise<Buffer> {
    let image = await Jimp.fromBuffer(img);
    
    // Convert to greyscale manually for compatibility
    image.scan(0, 0, WIDTH, HEIGHT, function(this: { bitmap: { data: Buffer } }, x: number, y: number, idx: number) {
        const r = this.bitmap.data[idx + 0];
        const g = this.bitmap.data[idx + 1];
        const b = this.bitmap.data[idx + 2];
        // Luminance formula
        const grey = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        this.bitmap.data[idx + 0] = grey;
        this.bitmap.data[idx + 1] = grey;
        this.bitmap.data[idx + 2] = grey;
    });

    // Apply contrast enhancement
    const contrastFactor = 1.5; // Strong contrast
    image.scan(0, 0, WIDTH, HEIGHT, function(this: { bitmap: { data: Buffer } }, x: number, y: number, idx: number) {
        let value = this.bitmap.data[idx + 0];
        // Normalize to 0-1, apply contrast, back to 0-255
        value = Math.round(((value / 255 - 0.5) * contrastFactor + 0.5) * 255);
        // Clamp to 0-255
        value = Math.max(0, Math.min(255, value));
        this.bitmap.data[idx + 0] = value;
        this.bitmap.data[idx + 1] = value;
        this.bitmap.data[idx + 2] = value;
    });

    // Find bounding box of content (non-white pixels)
    let topCrop = HEIGHT;
    let leftCrop = WIDTH;
    let bottomCrop = 0;
    let rightCrop = 0;
    
    const threshold = 200; // Pixels brighter than this are considered white
    
    // Scan for top edge
    outerTop: for (let y = 0; y < HEIGHT; y++) {
        for (let x = 0; x < WIDTH; x++) {
            const idx = y * WIDTH * 4 + x * 4;
            const brightness = image.bitmap.data[idx]; // Since greyscale, R=G=B
            if (brightness < threshold) {
                topCrop = y;
                break outerTop;
            }
        }
    }
    
    // Scan for left edge
    outerLeft: for (let x = 0; x < WIDTH; x++) {
        for (let y = 0; y < HEIGHT; y++) {
            const idx = y * WIDTH * 4 + x * 4;
            const brightness = image.bitmap.data[idx];
            if (brightness < threshold) {
                leftCrop = x;
                break outerLeft;
            }
        }
    }
    
    // Scan for bottom edge
    outerBottom: for (let y = HEIGHT - 1; y >= 0; y--) {
        for (let x = 0; x < WIDTH; x++) {
            const idx = y * WIDTH * 4 + x * 4;
            const brightness = image.bitmap.data[idx];
            if (brightness < threshold) {
                bottomCrop = y;
                break outerBottom;
            }
        }
    }
    
    // Scan for right edge
    outerRight: for (let x = WIDTH - 1; x >= 0; x--) {
        for (let y = 0; y < HEIGHT; y++) {
            const idx = y * WIDTH * 4 + x * 4;
            const brightness = image.bitmap.data[idx];
            if (brightness < threshold) {
                rightCrop = x;
                break outerRight;
            }
        }
    }

    // Ensure we found content
    if (topCrop >= bottomCrop || leftCrop >= rightCrop) {
        // If no content found, use full image
        topCrop = 0;
        leftCrop = 0;
        bottomCrop = HEIGHT;
        rightCrop = WIDTH;
    }

    const cropWidth = rightCrop - leftCrop;
    const cropHeight = bottomCrop - topCrop;
    
    // Apply crop and resize to 256x256
    const croppedImage = image.crop({
        x: leftCrop,
        y: topCrop,
        w: cropWidth,
        h: cropHeight
    }).resize({ w: 256, h: 256 });

    return croppedImage.getBuffer('image/png');
}