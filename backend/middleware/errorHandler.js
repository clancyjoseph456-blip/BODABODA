/** Central error handler. Converts thrown/rejected errors into clean JSON. */
function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  // Multer and validation errors surface as RangeError or plain Error.
  if (error instanceof RangeError) {
    return res.status(400).json({ message: error.message });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large.' });
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, error);

  return res.status(error.status || 500).json({
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : error.message
  });
}

/** 404 fallback for unmatched /api routes. */
function notFound(req, res) {
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFound };
