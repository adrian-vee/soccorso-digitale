const { getDefaultConfig } = require("expo/metro-config");
const { createProxyMiddleware } = require("http-proxy-middleware");

const config = getDefaultConfig(__dirname);

const adminProxy = createProxyMiddleware({
  target: "http://127.0.0.1:5000",
  changeOrigin: true,
  ws: true,
});

const apiProxy = createProxyMiddleware({
  target: "http://127.0.0.1:5000",
  changeOrigin: true,
});

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url.startsWith("/admin")) {
        return adminProxy(req, res, next);
      }
      
      if (req.url.startsWith("/api")) {
        return apiProxy(req, res, next);
      }
      
      // Proxy special pages to Express server
      if (req.url === "/impatto" || req.url === "/partner-proposal" || 
          req.url === "/partner-assicurazioni" || req.url === "/platform") {
        return apiProxy(req, res, next);
      }
      
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
