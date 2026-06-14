import { Jimp } from 'jimp'
import { HEIGHT, WIDTH } from './const';

export async function processImage(img: Buffer) {
    let image = (await Jimp.fromBuffer(img))
        .greyscale()
        .contrast(1)

    let topCrop = 0;
    for (let y = 0; y < HEIGHT; y++) {
        let finedWhite = false;
        for (let x = 0; x < WIDTH; x++) {
            if (image.bitmap.data[x * 4 + y * WIDTH * 4]) {
                finedWhite = true;
                break;
            }
        }
        if (finedWhite) {
            topCrop = y;
            break;
        }
    }
    let leftCrop = 0;
    for (let x = 0; x < WIDTH; x++) {
        let finedWhite = false;
        for (let y = 0; y < HEIGHT; y++) {
            if (image.bitmap.data[x * 4 + y * WIDTH * 4]) {
                finedWhite = true;
                break;
            }
        }
        if (finedWhite) {
            leftCrop = x;
            break;
        }
    }
    let bottomCrop = 0;
    for (let y = (HEIGHT - 1); y > 0; y--) {
        let finedWhite = false;
        for (let x = 0; x < WIDTH; x++) {
            if (image.bitmap.data[x * 4 + y * WIDTH * 4]) {
                finedWhite = true;
                break;
            }
        }
        if (finedWhite) {
            bottomCrop = y;
            break;
        }
    }
    let rightCrop = 0;
    for (let x = (WIDTH - 1); x > 0; x--) {
        let finedWhite = false;
        for (let y = 0; y < HEIGHT; y++) {
            if (image.bitmap.data[x * 4 + y * WIDTH * 4]) {
                finedWhite = true;
                break;
            }
        }
        if (finedWhite) {
            rightCrop = x;
            break;
        }
    }
    
    const croppedImage = image.crop({
        x: leftCrop,
        y: topCrop,
        w: rightCrop - leftCrop,
        h: bottomCrop - topCrop
    }).resize({ w: 256, h: 256 })

    return croppedImage.getBuffer('image/png')
}
