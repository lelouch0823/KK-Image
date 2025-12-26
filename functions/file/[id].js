/**
 * @fileoverview 文件访问处理
 * @module file/[id]
 * 
 * 支持多存储后端：根据元数据中的 storageProvider 字段路由到对应存储
 */

import { getProviderForFile, getStorageProvider, StorageProviderType } from '../storage/index.js';

// Telegram Bot API 上传的文件 ID 最小路径长度
const TELEGRAM_FILE_ID_MIN_LENGTH = 39;

export async function onRequest(context) {
    const { request, env, params } = context;

    const url = new URL(request.url);
    const pathname = url.pathname;
    const origin = url.origin;
    const fileId = params.id;

    // Allow the admin page to directly view the image (bypass checks)
    const isAdmin = request.headers.get('Referer')?.includes(`${origin}/admin`);

    // 检查 KV 存储获取文件元数据
    let metadata = null;
    let record = null;

    if (env.img_url) {
        record = await env.img_url.getWithMetadata(fileId);
        metadata = record?.metadata;
    }

    // 根据元数据或文件特征确定存储提供者
    let storageProvider;

    if (metadata?.storageProvider) {
        // 使用元数据中记录的存储提供者
        storageProvider = getProviderForFile(env, metadata);
    } else if (pathname.length > TELEGRAM_FILE_ID_MIN_LENGTH) {
        // 旧格式：长路径表示 Telegram 文件
        storageProvider = getStorageProvider(env, StorageProviderType.TELEGRAM);
    } else {
        // 使用默认存储提供者
        storageProvider = getStorageProvider(env);
    }

    // 从存储提供者获取文件
    const response = await storageProvider.getFile(fileId, request);

    // 如果文件获取失败，直接返回
    if (!response.ok) {
        return response;
    }

    // 管理员直接返回文件内容
    if (isAdmin) {
        return response;
    }

    // 如果 KV 不可用，直接返回
    if (!env.img_url) {
        return response;
    }

    // 初始化或更新元数据
    if (!metadata) {
        metadata = {
            ListType: "None",
            Label: "None",
            TimeStamp: Date.now(),
            liked: false,
            fileName: fileId,
            fileSize: 0,
            storageProvider: storageProvider.name
        };
        await env.img_url.put(fileId, "", { metadata });
    }

    // 确保元数据字段完整
    const fullMetadata = {
        ListType: metadata.ListType || "None",
        Label: metadata.Label || "None",
        TimeStamp: metadata.TimeStamp || Date.now(),
        liked: metadata.liked !== undefined ? metadata.liked : false,
        fileName: metadata.fileName || fileId,
        fileSize: metadata.fileSize || 0,
        storageProvider: metadata.storageProvider || storageProvider.name
    };

    // 根据 ListType 和 Label 处理访问控制
    if (fullMetadata.ListType === "White") {
        return response;
    } else if (fullMetadata.ListType === "Block" || fullMetadata.Label === "adult") {
        const referer = request.headers.get('Referer');
        const redirectUrl = referer
            ? "https://static-res.pages.dev/teleimage/img-block-compressed.png"
            : `${origin}/block-img.html`;
        return Response.redirect(redirectUrl, 302);
    }

    // 检查白名单模式
    if (env.WhiteList_Mode === "true") {
        return Response.redirect(`${origin}/whitelist-on.html`, 302);
    }

    // 内容审查（仅适用于可访问 URL 的存储，如 Telegram）
    if (env.ModerateContentApiKey && storageProvider.name === 'telegram') {
        try {
            const moderateUrl = `https://api.moderatecontent.com/moderate/?key=${env.ModerateContentApiKey}&url=https://telegra.ph${pathname}${url.search}`;
            const moderateResponse = await fetch(moderateUrl);

            if (moderateResponse.ok) {
                const moderateData = await moderateResponse.json();

                if (moderateData?.rating_label) {
                    fullMetadata.Label = moderateData.rating_label;

                    if (moderateData.rating_label === "adult") {
                        await env.img_url.put(fileId, "", { metadata: fullMetadata });
                        return Response.redirect(`${origin}/block-img.html`, 302);
                    }
                }
            }
        } catch (error) {
            console.error("Content moderation error:", error.message);
        }
    }

    // 更新元数据
    await env.img_url.put(fileId, "", { metadata: fullMetadata });

    return response;
}