/**
 * 轻量级 Blurhash 解码器
 * @module utils/blurhash
 *
 * 基于 woltapp/blurhash 的简化实现
 * 用于将 Blurhash 字符串解码为可用于占位符的 Data URL
 */

const digitCharacters =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

/**
 * 解码 Base83 字符
 * @param {string} str
 * @returns {number}
 */
function decode83(str) {
    let value = 0;
    for (let i = 0; i < str.length; i++) {
        const c = str[i];
        const digit = digitCharacters.indexOf(c);
        value = value * 83 + digit;
    }
    return value;
}

/**
 * sRGB 转线性
 * @param {number} value 0-255
 * @returns {number}
 */
function sRGBToLinear(value) {
    const v = value / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * 线性转 sRGB
 * @param {number} value
 * @returns {number}
 */
function linearToSRGB(value) {
    const v = Math.max(0, Math.min(1, value));
    return v <= 0.0031308
        ? Math.round(v * 12.92 * 255 + 0.5)
        : Math.round((1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255 + 0.5);
}

/**
 * 解码颜色
 * @param {number} value
 * @returns {number[]}
 */
function decodeDC(value) {
    const r = value >> 16;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return [sRGBToLinear(r), sRGBToLinear(g), sRGBToLinear(b)];
}

/**
 * 解码 AC 分量
 * @param {number} value
 * @param {number} maximumValue
 * @returns {number[]}
 */
function decodeAC(value, maximumValue) {
    const quantR = Math.floor(value / (19 * 19));
    const quantG = Math.floor(value / 19) % 19;
    const quantB = value % 19;

    return [
        signPow((quantR - 9) / 9, 2.0) * maximumValue,
        signPow((quantG - 9) / 9, 2.0) * maximumValue,
        signPow((quantB - 9) / 9, 2.0) * maximumValue,
    ];
}

/**
 * 带符号的幂运算
 * @param {number} base
 * @param {number} exp
 * @returns {number}
 */
function signPow(base, exp) {
    return Math.sign(base) * Math.pow(Math.abs(base), exp);
}

/**
 * 解码 Blurhash 字符串
 * @param {string} blurhash - Blurhash 字符串
 * @param {number} width - 输出图像宽度 (推荐 32)
 * @param {number} height - 输出图像高度 (推荐 32)
 * @param {number} punch - 颜色增强系数 (默认 1)
 * @returns {Uint8ClampedArray} RGBA 像素数据
 */
export function decode(blurhash, width, height, punch = 1) {
    if (!blurhash || blurhash.length < 6) {
        throw new Error('Invalid blurhash');
    }

    const sizeFlag = decode83(blurhash[0]);
    const numY = Math.floor(sizeFlag / 9) + 1;
    const numX = (sizeFlag % 9) + 1;

    const quantisedMaximumValue = decode83(blurhash[1]);
    const maximumValue = (quantisedMaximumValue + 1) / 166;

    const colors = new Array(numX * numY);

    for (let i = 0; i < colors.length; i++) {
        if (i === 0) {
            const value = decode83(blurhash.substring(2, 6));
            colors[i] = decodeDC(value);
        } else {
            const value = decode83(blurhash.substring(4 + i * 2, 6 + i * 2));
            colors[i] = decodeAC(value, maximumValue * punch);
        }
    }

    const pixels = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let r = 0;
            let g = 0;
            let b = 0;

            for (let j = 0; j < numY; j++) {
                for (let i = 0; i < numX; i++) {
                    const basis =
                        Math.cos((Math.PI * x * i) / width) * Math.cos((Math.PI * y * j) / height);
                    const color = colors[i + j * numX];
                    r += color[0] * basis;
                    g += color[1] * basis;
                    b += color[2] * basis;
                }
            }

            const idx = 4 * (x + y * width);
            pixels[idx] = linearToSRGB(r);
            pixels[idx + 1] = linearToSRGB(g);
            pixels[idx + 2] = linearToSRGB(b);
            pixels[idx + 3] = 255;
        }
    }

    return pixels;
}

/**
 * 将 Blurhash 解码为 Data URL
 * @param {string} blurhash - Blurhash 字符串
 * @param {number} width - 输出宽度 (默认 32)
 * @param {number} height - 输出高度 (默认 32)
 * @returns {string} Data URL
 */
export function blurhashToDataURL(blurhash, width = 32, height = 32) {
    if (typeof document === 'undefined') return '';

    try {
        const pixels = decode(blurhash, width, height);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);
        imageData.data.set(pixels);
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL();
    } catch {
        return '';
    }
}

/**
 * 验证 Blurhash 字符串是否有效
 * @param {string} blurhash
 * @returns {boolean}
 */
export function isBlurhashValid(blurhash) {
    if (!blurhash || typeof blurhash !== 'string') return false;
    if (blurhash.length < 6) return false;

    try {
        const sizeFlag = decode83(blurhash[0]);
        const numY = Math.floor(sizeFlag / 9) + 1;
        const numX = (sizeFlag % 9) + 1;
        const expectedLength = 4 + 2 * numX * numY;
        return blurhash.length === expectedLength;
    } catch {
        return false;
    }
}
