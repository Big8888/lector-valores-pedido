const express = require('express');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.send('Servidor OK');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'lector-valores-pedido',
    timestamp: new Date().toISOString()
  });
});

app.use('/webhook', webhookRoutes);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Ruta no encontrada.',
    method: req.method,
    path: req.originalUrl
  });
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Error interno del servidor.';

  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    statusCode,
    message
  };

  if (statusCode >= 500) {
    console.error('[ERROR 500+]', errorLog, error);
  } else {
    console.warn('[ERROR CONTROLADO]', errorLog);
  }

  res.status(statusCode).json({
    ok: false,
    error: message
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`[BOOT] Servidor corriendo en puerto ${port}`);
  });
}

module.exports = app;