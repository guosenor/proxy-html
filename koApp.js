
const Koa = require('koa');
const app = new Koa();
const httpProxy = require('http-proxy');
// const bodyparser = require('koa-body');
const Router = require('koa-router');
const router = new Router();

const proxy = httpProxy.createProxyServer({
  target: 'http://192.168.1.106:9001',
});

/**
 *  如果已经 bodyparser 则放开下面代码
 */

// proxy.on('proxyReq', (proxyReq, req) => {
//   if (req.body && req.method === 'POST') {
//     const bodyData = JSON.stringify(req.body);
//     // incase if content-type is application/x-www-form-urlencoded -> we need to change to application/json
//     proxyReq.setHeader('Content-Type', 'application/json');
//     proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
//     // stream the content
//     proxyReq.write(bodyData);
//   }
// });
proxy.on('proxyRes', (proxyRes, req, res) => {
  //console.log(proxyRes.headers['content-type'])
  if (proxyRes.statusCode === 200 &&( proxyRes.headers["content-type"]==='text/html'||proxyRes.headers['content-type']==='application/javascript')) {
    const oriWriteHead = res.writeHead;
    const oriWrite = res.write;
    const oriEnd = res.end;
    let htmlStr = '';
    Object.assign(res, {
      writeHead: () => {},
      write: (chunk) => {
        htmlStr += chunk.toString();
      },
      end: () => {
        if(proxyRes.headers['content-type']==='text/html'){
          htmlStr=htmlStr.replace(/static\/js/g,'proxy/static/js');
          htmlStr=htmlStr.replace(/static\/css/g,'proxy/static/css');
          htmlStr = htmlStr.replace('/favicon.ico','proxy/favicon.ico')
        }
        if(proxyRes.headers['content-type']==='application/javascript'){
          htmlStr = htmlStr.replace('baseURL:"/api"','baseURL:"/proxy/api"')
        }
    
        // htmlStr=htmlStr.replace(/src=\//g,'src=/proxy/');
        // htmlStr=htmlStr.replace(/href=\//g,'href=/proxy/');
   
        // console.log(htmlStr)
        const buffer =  Buffer.from(htmlStr); // 一定要转成buffer，buffer长度和string长度不一样
        const headers = Object.keys(proxyRes.headers)
          .reduce((prev, curr) => {
            const value = curr === 'content-length' ? buffer.length : proxyRes.headers[curr];
            return Object.assign({}, prev, { [curr]: value });
          }, {});
        oriWriteHead.apply(res, [proxyRes.statusCode, headers]);
        oriWrite.call(res, buffer);
        oriEnd.call(res);
      }
    });
  }
});
router.use('/proxy', new Router().all('*',async (ctx)=>{
  await new Promise(function(resolve) {
    // const options = {
    //   target: gateway.baseUrl,
    //   preserveHeaderKeyCase: true,
    //   // changeOrigin: true,
    // };
    ctx.req.url = ctx.req.url.replace('/proxy','');
    
    /**
     *  如果已经 bodyparser 则放开下面代码
     */
    // if (ctx.req.method === 'POST' || ctx.req.method === 'PUT') {
    //   ctx.req.body = ctx.request.body;
    // }
    proxy.web(ctx.req, ctx.res, {preserveHeaderKeyCase: true}, function(e) {
      ctx.app.logger.error(`error:${e.message}`);
      ctx.fail(new Error('server error'));
      resolve();
    });
    ctx.res.on('finish', function() {
      resolve();
    });
  });
}).routes());
// app.use(bodyparser());
app.use(router.routes());
app.listen(3000);