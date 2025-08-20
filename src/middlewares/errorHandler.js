export function errorHandler(err, req, res, next) { // eslint-disable-line
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  // Podés loguear más info aquí si querés
  res.status(status).json({ error: message });
}
