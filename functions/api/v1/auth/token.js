// Token 生成端点
import { generateJWT } from '../../utils/auth.js';
import { validateUserCredentials } from '../../utils/users.js';
import { success, error } from '../../utils/response.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const credentials = await request.json();

        // 验证请求参数
        if (!credentials.username || !credentials.password) {
            return error('Username and password are required', 400);
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
                return error('Invalid credentials', 401);
            }
        }

        const expiresIn = credentials.expiresIn || 3600; // 默认1小时
        const token = await generateJWT(user, env, expiresIn);

        return success({
            token: token,
            tokenType: 'Bearer',
            expiresIn: expiresIn,
            user: {
                id: user.id,
                name: user.name,
                permissions: user.permissions
            }
        });

    } catch (error) {
        console.error('Error generating token:', error);
        return error(error.message, 500);
    }
}
