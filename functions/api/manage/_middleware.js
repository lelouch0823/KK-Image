async function errorHandling(context) {
  try {
    return await context.next();
  } catch (err) {
    // 记录完整错误到日志，但不暴露给客户端
    console.error('Manage API Error:', err.message, err.stack);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: err.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function basicAuthentication(request) {
  const Authorization = request.headers.get('Authorization');

  const [scheme, encoded] = Authorization.split(' ');

  // The Authorization header must start with Basic, followed by a space.
  if (!encoded || scheme !== 'Basic') {
    throw new BadRequestException('Malformed authorization header.');
  }

  // Decodes the base64 value and performs unicode normalization.
  // @see https://datatracker.ietf.org/doc/html/rfc7613#section-3.3.2 (and #section-4.2.2)
  // @see https://dev.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
  const buffer = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  const decoded = new TextDecoder().decode(buffer).normalize();

  // The username & password are split by the first colon.
  //=> example: "username:password"
  const index = decoded.indexOf(':');

  // The user & password are split by the first colon and MUST NOT contain control characters.
  // @see https://tools.ietf.org/html/rfc5234#appendix-B.1 (=> "CTL = %x00-1F / %x7F")
  if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
    throw new BadRequestException('Invalid authorization value.');
  }

  return {
    user: decoded.substring(0, index),
    pass: decoded.substring(index + 1),
  };
}

function UnauthorizedException(reason) {
  return new Response(reason, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      // Disables caching by default.
      'Cache-Control': 'no-store',
      // Returns the "Content-Length" header for HTTP HEAD requests.
      'Content-Length': reason.length,
    },
  });
}

function BadRequestException(reason) {
  return new Response(reason, {
    status: 400,
    statusText: 'Bad Request',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      // Disables caching by default.
      'Cache-Control': 'no-store',
      // Returns the "Content-Length" header for HTTP HEAD requests.
      'Content-Length': reason.length,
    },
  });
}


function authentication(context) {
  const { env, request } = context;

  // 检查 KV 存储是否配置
  if (!env.img_url) {
    return new Response(JSON.stringify({
      error: 'Dashboard disabled',
      message: 'Please bind a KV namespace to use this feature.'
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 如果未配置 Basic Auth，则跳过认证
  if (!env.BASIC_USER) {
    return context.next();
  }

  // 检查是否提供了 Authorization 头
  if (!request.headers.has('Authorization')) {
    return new Response(JSON.stringify({
      error: 'Authentication required',
      message: 'Please provide credentials to access this resource.'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Basic realm="Admin Dashboard", charset="UTF-8"'
      }
    });
  }

  // 验证凭据
  try {
    const { user, pass } = basicAuthentication(request);

    if (env.BASIC_USER !== user || env.BASIC_PASS !== pass) {
      return UnauthorizedException('Invalid credentials.');
    }

    return context.next();
  } catch (error) {
    return BadRequestException(error.message || 'Invalid authorization header.');
  }
}

export const onRequest = [errorHandling, authentication];