/**
 * DreamInk 专属极致跨域代理 (Cloudflare Worker)
 * 
 * 部署保姆级教程：
 * 1. 注册并登录 Cloudflare -> 左侧菜单选 Workers & Pages -> 创建应用程序 -> 创建 Worker
 * 2. 随便起个名字（比如 dreamink-proxy），点击部署
 * 3. 点击“编辑代码”，把这个文件里的代码全部粘贴进去，覆盖掉原有内容
 * 4. 点击右上角“部署”保存
 * 
 * 🎉 大功告成！
 * 
 * 在 DreamInk 的【接口地址】里怎么填？
 * 公式：https://你的worker地址/你要代理的真实API地址
 * 例如原本你的 API 是：https://api.openai.com
 * 现在填入：https://dreamink-proxy.你的账号.workers.dev/https://api.openai.com
 * 
 * 彻底告别浏览器的跨域报错！
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 如果只访问根目录，给个提示
    if (url.pathname === '/' || url.pathname === '') {
      return new Response('✅ DreamInk CORS Proxy is running!\n\n用法: https://你的worker地址/https://目标API地址', { status: 200 });
    }

    // 提取目标 URL
    let targetUrlStr = url.pathname.slice(1) + url.search;
    if (!targetUrlStr.startsWith('http')) {
      targetUrlStr = 'https://' + targetUrlStr;
    }

    try {
      const targetUrl = new URL(targetUrlStr);
      
      // 构造新请求
      const newRequest = new Request(targetUrl.toString(), new Request(request));
      // 删除这两个头，防止目标服务器查户口
      newRequest.headers.delete('origin');
      newRequest.headers.delete('referer');

      // 拦截浏览器的 OPTIONS 预检请求，直接放行
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '*',
            'Access-Control-Max-Age': '86400',
          }
        });
      }

      // 获取目标 API 的真实响应
      let response = await fetch(newRequest);
      let newResponse = new Response(response.body, response);

      // 给真实响应强行打上允许跨域的烙印
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      newResponse.headers.set('Access-Control-Allow-Headers', '*');

      return newResponse;

    } catch (e) {
      return new Response(`DreamInk Proxy Error: ${e.message}`, { status: 500 });
    }
  }
};
