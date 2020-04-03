
const app = require('express')();
const httpProxy = require('http-proxy');
const proxy = httpProxy.createProxyServer({
  target: 'http://192.168.1.106:9001',
});
proxy.on('proxyRes', (proxyRes, req, res) => {
  //console.log(proxyRes.headers['content-type'])
  if (proxyRes.statusCode === 200 && (proxyRes.headers["content-type"] === 'text/html' || proxyRes.headers['content-type'] === 'application/javascript')) {
    const oriWriteHead = res.writeHead;
    const oriWrite = res.write;
    const oriEnd = res.end;
    let htmlStr = '';
    Object.assign(res, {
      writeHead: () => { },
      write: (chunk) => {
        htmlStr += chunk.toString();
      },
      end: () => {
        if (proxyRes.headers['content-type'] === 'text/html') {
          htmlStr = htmlStr.replace(/static\/js/g, 'proxy/static/js');
          htmlStr = htmlStr.replace(/static\/css/g, 'proxy/static/css');
          htmlStr = htmlStr.replace('/favicon.ico', 'proxy/favicon.ico')
        }
        if (proxyRes.headers['content-type'] === 'application/javascript') {
          htmlStr = htmlStr.replace('baseURL:"/api"', 'baseURL:"/proxy/api"')
        }

        // htmlStr=htmlStr.replace(/src=\//g,'src=/proxy/');
        // htmlStr=htmlStr.replace(/href=\//g,'href=/proxy/');

        // console.log(htmlStr)
        const buffer = Buffer.from(htmlStr); // 一定要转成buffer，buffer长度和string长度不一样
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
app.use('/proxy', function (req, res) {
  proxy.web(req, res)
});

app.listen(3000);