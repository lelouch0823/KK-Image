// Token 生成端点
import { generateJWT } from '../../utils/auth.js';
import { validateUserCredentials } from '../../utils/users.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const credentials = await request.json();

        // 验证请求参数
        if (!credentials.username || !credentials.password) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Username and password are required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 验证用户凭据
        let user;
        try {
            user = await validateUserCredentials(credentials.username, credentials.password, env);
        } catch (error) {
            // 尝试使用 BASIC_USER/BASIC_PASS 环境变量验证
            if (env.BASIC_USER && env.BASIC_PASS &&
                credentials.username === env.BASIC_USER &&
                credentials.password === env.BASIC_PASS) {
                user = {
                    id: 'admin',
                    name: 'Administrator',
                    permissions: ['admin:full']
                };
            } else {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'Invalid credentials'
                }), {
                    status: 401,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }

        const expiresIn = credentials.expiresIn || 3600; // 默认1小时
        const token = await generateJWT(user, env, expiresIn);

        return new Response(JSON.stringify({
            success: true,
            data: {
                token: token,
                tokenType: 'Bearer',
                expiresIn: expiresIn,
                user: {
                    id: user.id,
                    name: user.name,
                    permissions: user.permissions
                }
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error generating token:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
