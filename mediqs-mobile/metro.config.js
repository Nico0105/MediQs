// ======================================================
// Configuración de Metro (metro.config.js)
// Además de la config por defecto de Expo, el servidor de
// desarrollo REENVÍA /api/* al backend local (puerto 4000).
// Así el celular sólo necesita llegar a Metro: funciona en
// la misma red Wi-Fi y también con `expo start --tunnel`
// (redes de facultad/empresa que aíslan dispositivos).
// ======================================================
const http = require('http');
const { getDefaultConfig } = require('expo/metro-config');

const BACKEND_HOST = process.env.MEDIQS_BACKEND_HOST || '127.0.0.1';
const BACKEND_PORT = Number(process.env.MEDIQS_BACKEND_PORT || 4000);

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => (req, res, next) => {
    if (!req.url || !req.url.startsWith('/api/')) return middleware(req, res, next);

    const proxyReq = http.request(
      {
        host: BACKEND_HOST,
        port: BACKEND_PORT,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, host: `${BACKEND_HOST}:${BACKEND_PORT}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      },
    );
    proxyReq.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No se pudo conectar con el backend (¿está corriendo en el puerto 4000?)' }));
    });
    req.pipe(proxyReq);
  },
};

module.exports = config;
