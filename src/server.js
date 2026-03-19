const express = require('express');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.send('Servidor OK');
});

app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

app.use('/webhook', webhookRoutes);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: 'Ruta no encontrada.'
  });
});

app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Error interno del servidor.';

  if (statusCode >= 500) {
    console.error('Error procesando la solicitud:', error);
  }

  res.status(statusCode).json({
    ok: false,
    error: message
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Servidor corriendo en puerto ${port}`);
  });
}

module.exports = app;
