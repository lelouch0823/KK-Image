/**
 * @fileoverview S3 兼容存储提供者
 * @module storage/providers/s3
 * 
 * 支持 Amazon S3 及兼容服务：MinIO、阿里云 OSS、腾讯 COS 等
 */

import { BaseStorageProvider } from '../base-provider.js';

/**
 * S3 兼容存储提供者
 */
export class S3StorageProvider extends BaseStorageProvider {
    constructor(env) {
        super(env);
        this.name = 's3';
    }

    /**
     * 检查 S3 配置是否完整
     * @returns {boolean}
     */
    isConfigured() {
        return !!(
            this.env.S3_ENDPOINT &&
            this.env.S3_BUCKET &&
            this.env.S3_ACCESS_KEY_ID &&
            this.env.S3_SECRET_ACCESS_KEY
        );
    }

    /**
     * 上传文件到 S3
     * @param {File|Blob} file
     * @param {Object} options
     * @returns {Promise<import('../base-provider.js').UploadResult>}
     */
    async upload(file, options = {}) {
        if (!this.isConfigured()) {
            return { success: false, error: 'S3 not configured' };
        }

        const fileName = options.fileName || file.name || 'file';
        const fileId = this.generateFileId(fileName);
        const contentType = file.type || options.contentType || 'application/octet-stream';

        try {
            const arrayBuffer = await file.arrayBuffer();
            const url = this._buildUrl(fileId);
            const method = 'PUT';

            const headers = await this._signRequest(method, `/${fileId}`, {
                'Content-Type': contentType,
                'Content-Length': arrayBuffer.byteLength.toString(),
                'x-amz-content-sha256': await this._sha256Hex(arrayBuffer)
            }, arrayBuffer);

            const response = await fetch(url, {
                method,
                headers,
                body: arrayBuffer
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('S3 upload error:', errorText);
                return { success: false, error: `S3 upload failed: ${response.status}` };
            }

            return {
                success: true,
                fileId: fileId,
                url: `/file/${fileId}`,
                metadata: {
                    storageProvider: this.name,
                    storageId: fileId,
                    fileName: fileName,
                    fileSize: file.size,
                    contentType: contentType
                }
            };
        } catch (error) {
            console.error('S3 upload error:', error);
            return { success: false, error: `S3 upload failed: ${error.message}` };
        }
    }

    /**
     * 从 S3 获取文件
     * @param {string} fileId
     * @param {Request} [request]
     * @returns {Promise<Response>}
     */
    async getFile(fileId, request) {
        if (!this.isConfigured()) {
            return new Response('S3 not configured', { status: 500 });
        }

        try {
            const url = this._buildUrl(fileId);
            const method = 'GET';

            const headers = await this._signRequest(method, `/${fileId}`, {
                'x-amz-content-sha256': 'UNSIGNED-PAYLOAD'
            });

            const response = await fetch(url, { method, headers });

            if (!response.ok) {
                if (response.status === 404) {
                    return new Response('File not found', { status: 404 });
                }
                return new Response('Failed to retrieve file', { status: 500 });
            }

            // 添加缓存头
            const responseHeaders = new Headers(response.headers);
            responseHeaders.set('Cache-Control', 'public, max-age=31536000');

            return new Response(response.body, {
                status: response.status,
                headers: responseHeaders
            });
        } catch (error) {
            console.error('S3 get file error:', error);
            return new Response('Failed to retrieve file', { status: 500 });
        }
    }

    /**
     * 从 S3 删除文件
     * @param {string} fileId
     * @returns {Promise<boolean>}
     */
    async deleteFile(fileId) {
        if (!this.isConfigured()) {
            return false;
        }

        try {
            const url = this._buildUrl(fileId);
            const method = 'DELETE';

            const headers = await this._signRequest(method, `/${fileId}`, {
                'x-amz-content-sha256': 'UNSIGNED-PAYLOAD'
            });

            const response = await fetch(url, { method, headers });
            return response.ok || response.status === 404;
        } catch (error) {
            console.error('S3 delete error:', error);
            return false;
        }
    }

    /**
     * 构建 S3 URL
     * @private
     */
    _buildUrl(key) {
        const endpoint = this.env.S3_ENDPOINT.replace(/\/$/, '');
        const bucket = this.env.S3_BUCKET;

        // 支持路径风格和虚拟主机风格
        if (endpoint.includes(bucket)) {
            return `${endpoint}/${key}`;
        }
        return `${endpoint}/${bucket}/${key}`;
    }

    /**
     * AWS Signature Version 4 签名
     * @private
     */
    async _signRequest(method, canonicalUri, additionalHeaders = {}, body = null) {
        const region = this.env.S3_REGION || 'auto';
        const service = 's3';
        const accessKeyId = this.env.S3_ACCESS_KEY_ID;
        const secretAccessKey = this.env.S3_SECRET_ACCESS_KEY;

        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
        const dateStamp = amzDate.slice(0, 8);

        // 构建主机名
        const endpoint = new URL(this.env.S3_ENDPOINT);
        const host = endpoint.host;

        // 规范请求头
        const headers = {
            'Host': host,
            'x-amz-date': amzDate,
            ...additionalHeaders
        };

        const signedHeaders = Object.keys(headers)
            .map(k => k.toLowerCase())
            .sort()
            .join(';');

        const canonicalHeaders = Object.keys(headers)
            .map(k => `${k.toLowerCase()}:${headers[k].trim()}`)
            .sort()
            .join('\n') + '\n';

        // 负载哈希
        const payloadHash = headers['x-amz-content-sha256'] ||
            (body ? await this._sha256Hex(body) : 'UNSIGNED-PAYLOAD');

        // 规范请求
        const canonicalRequest = [
            method,
            canonicalUri,
            '', // 查询字符串
            canonicalHeaders,
            signedHeaders,
            payloadHash
        ].join('\n');

        const canonicalRequestHash = await this._sha256Hex(canonicalRequest);

        // 待签字符串
        const algorithm = 'AWS4-HMAC-SHA256';
        const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
        const stringToSign = [
            algorithm,
            amzDate,
            credentialScope,
            canonicalRequestHash
        ].join('\n');

        // 签名密钥
        const kDate = await this._hmac(`AWS4${secretAccessKey}`, dateStamp);
        const kRegion = await this._hmac(kDate, region);
        const kService = await this._hmac(kRegion, service);
        const kSigning = await this._hmac(kService, 'aws4_request');

        // 计算签名
        const signature = await this._hmacHex(kSigning, stringToSign);

        // 授权头
        const authorization = `${algorithm} Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        return {
            ...headers,
            'Authorization': authorization
        };
    }

    /**
     * HMAC-SHA256
     * @private
     */
    async _hmac(key, data) {
        const encoder = new TextEncoder();
        const keyData = typeof key === 'string' ? encoder.encode(key) : key;
        const dataData = encoder.encode(data);

        const cryptoKey = await crypto.subtle.importKey(
            'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        );

        return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, dataData));
    }

    /**
     * HMAC-SHA256 (返回十六进制)
     * @private
     */
    async _hmacHex(key, data) {
        const result = await this._hmac(key, data);
        return Array.from(result).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * SHA-256 哈希 (返回十六进制)
     * @private
     */
    async _sha256Hex(data) {
        const encoder = new TextEncoder();
        const dataBuffer = typeof data === 'string' ? encoder.encode(data) : data;
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
}
