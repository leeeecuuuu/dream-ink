export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS, PUT, DELETE, PROPFIND, MKCOL',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Depth, X-Target-Url',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Type',
    };

    // 1. 处理 OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 2. 获取目标 WebDAV 地址
    // 前端会在请求头中通过 X-Target-Url 传递真实的 WebDAV 地址
    const targetUrl = request.headers.get('X-Target-Url');

    if (!targetUrl) {
      return new Response('Missing X-Target-Url header. This proxy requires a target URL.', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // 3. 构建代理请求
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow',
    });

    // 移除自定义头，防止上游服务器报错
    proxyRequest.headers.delete('X-Target-Url');
    // 如果存在 Origin，可以考虑移除或修改
    proxyRequest.headers.delete('Origin');
    proxyRequest.headers.delete('Referer');

    try {
      // 4. 发送请求到真正的 WebDAV 服务器
      const response = await fetch(proxyRequest);
      const responseHeaders = new Headers(response.headers);
      
      // 5. 将 CORS 允许头添加到响应中，以便前端可以读取
      for (const [key, value] of Object.entries(corsHeaders)) {
        responseHeaders.set(key, value);
      }
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(\`Proxy Error: \${error.message}\`, { 
        status: 500, 
        headers: corsHeaders 
      });
    }
  }
};
