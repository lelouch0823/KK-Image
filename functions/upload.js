import { errorHandling, telemetryData } from "./utils/middleware.js";

const BASIC_AUTH_CHALLENGE = 'Basic realm="my scope", charset="UTF-8"';

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const authResponse = authenticateUploadRequest(request, env);
        if (authResponse) {
            return authResponse;
        }

        validateTelegramConfig(env);

        const clonedRequest = request.clone();
        const formData = await clonedRequest.formData();

        await errorHandling(context);
        telemetryData(context);

        const uploadFile = formData.get('file');
        if (!uploadFile) {
            throw new Error('No file uploaded');
        }

        const fileName = uploadFile.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();

        const telegramFormData = new FormData();
        telegramFormData.append("chat_id", env.TG_Chat_ID);

        // 根据文件类型选择合适的上传方式
        let apiEndpoint;
        if (uploadFile.type.startsWith('image/')) {
            telegramFormData.append("photo", uploadFile);
            apiEndpoint = 'sendPhoto';
        } else if (uploadFile.type.startsWith('audio/')) {
            telegramFormData.append("audio", uploadFile);
            apiEndpoint = 'sendAudio';
        } else if (uploadFile.type.startsWith('video/')) {
            telegramFormData.append("video", uploadFile);
            apiEndpoint = 'sendVideo';
        } else {
            telegramFormData.append("document", uploadFile);
            apiEndpoint = 'sendDocument';
        }

        const result = await sendToTelegram(telegramFormData, apiEndpoint, env);

        if (!result.success) {
            throw new Error(result.error);
        }

        const fileId = getFileId(result.data);

        if (!fileId) {
            throw new Error('Failed to get file ID');
        }

        // 将文件信息保存到 KV 存储
        if (env.img_url) {
            await env.img_url.put(`${fileId}.${fileExtension}`, "", {
                metadata: {
                    TimeStamp: Date.now(),
                    ListType: "None",
                    Label: "None",
                    liked: false,
                    fileName: fileName,
                    fileSize: uploadFile.size,
                }
            });
        }

        return new Response(
            JSON.stringify([{ 'src': `/file/${fileId}.${fileExtension}` }]),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    } catch (error) {
        console.error('Upload error:', error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

function getFileId(response) {
    if (!response.ok || !response.result) return null;

    const result = response.result;
    if (result.photo) {
        return result.photo.reduce((prev, current) =>
            (prev.file_size > current.file_size) ? prev : current
        ).file_id;
    }
    if (result.document) return result.document.file_id;
    if (result.video) return result.video.file_id;
    if (result.audio) return result.audio.file_id;

    return null;
}

async function sendToTelegram(formData, apiEndpoint, env, retryCount = 0) {
    const MAX_RETRIES = 2;
    const apiUrl = `https://api.telegram.org/bot${env.TG_Bot_Token}/${apiEndpoint}`;

    try {
        const response = await fetch(apiUrl, { method: "POST", body: formData });
        const responseData = await parseTelegramResponse(response);

        if (response.ok) {
            return { success: true, data: responseData };
        }

        // 图片上传失败时转为文档方式重试
        if (retryCount < MAX_RETRIES && apiEndpoint === 'sendPhoto') {
            console.log('Retrying image as document...');
            const newFormData = new FormData();
            newFormData.append('chat_id', formData.get('chat_id'));
            newFormData.append('document', formData.get('photo'));
            return await sendToTelegram(newFormData, 'sendDocument', env, retryCount + 1);
        }

        return {
            success: false,
            error: formatTelegramError(apiEndpoint, response, responseData)
        };
    } catch (error) {
        console.error('Network error:', error);
        if (retryCount < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            return await sendToTelegram(formData, apiEndpoint, env, retryCount + 1);
        }
        return { success: false, error: 'Network error occurred' };
    }
}

function authenticateUploadRequest(request, env) {
    const hasUser = !isEmptyBinding(env.UPLOAD_BASIC_USER);
    const hasPass = !isEmptyBinding(env.UPLOAD_BASIC_PASS);

    if (!hasUser && !hasPass) {
        return null;
    }

    if (!hasUser || !hasPass) {
        return jsonResponse(
            { error: 'UPLOAD_BASIC_USER and UPLOAD_BASIC_PASS must both be configured to protect uploads' },
            { status: 500 }
        );
    }

    if (!request.headers.has('Authorization')) {
        return new Response('You need to login.', {
            status: 401,
            headers: {
                'WWW-Authenticate': BASIC_AUTH_CHALLENGE,
            },
        });
    }

    const credentials = basicAuthentication(request);
    if (credentials instanceof Response) {
        return credentials;
    }

    if (env.UPLOAD_BASIC_USER !== credentials.user || env.UPLOAD_BASIC_PASS !== credentials.pass) {
        return plainTextResponse('Invalid upload credentials.', {
            status: 401,
            statusText: 'Unauthorized',
        });
    }

    return null;
}

function basicAuthentication(request) {
    const authorization = request.headers.get('Authorization') || '';
    const [scheme, encoded] = authorization.split(' ');

    if (!encoded || scheme !== 'Basic') {
        return plainTextResponse('Malformed authorization header.', {
            status: 400,
            statusText: 'Bad Request',
        });
    }

    const buffer = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    const decoded = new TextDecoder().decode(buffer).normalize();
    const index = decoded.indexOf(':');

    if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
        return plainTextResponse('Invalid authorization value.', {
            status: 400,
            statusText: 'Bad Request',
        });
    }

    return {
        user: decoded.substring(0, index),
        pass: decoded.substring(index + 1),
    };
}

function validateTelegramConfig(env) {
    if (isEmptyBinding(env.TG_Bot_Token)) {
        throw new Error('Missing required environment variable: TG_Bot_Token');
    }

    if (isEmptyBinding(env.TG_Chat_ID)) {
        throw new Error('Missing required environment variable: TG_Chat_ID');
    }
}

async function parseTelegramResponse(response) {
    const contentType = response.headers.get('Content-Type') || '';

    if (contentType.includes('application/json')) {
        return await response.json();
    }

    return { description: await response.text() };
}

function formatTelegramError(apiEndpoint, response, responseData) {
    const details = responseData?.description || responseData?.error_code || 'Upload to Telegram failed';
    return `Telegram ${apiEndpoint} failed: ${response.status} ${details}`;
}

function jsonResponse(data, init = {}) {
    const headers = new Headers(init.headers || {});
    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    return new Response(JSON.stringify(data), {
        ...init,
        headers,
    });
}

function plainTextResponse(reason, init) {
    return new Response(reason, {
        ...init,
        headers: {
            'Content-Type': 'text/plain;charset=UTF-8',
            'Cache-Control': 'no-store',
            'Content-Length': new TextEncoder().encode(reason).length,
        },
    });
}

function isEmptyBinding(value) {
    return typeof value === 'undefined' || value === null || value === '';
}
