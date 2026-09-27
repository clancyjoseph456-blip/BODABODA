/**
 * asyncHandler — wrap an async route handler so rejections reach Express.
 *
 * Express 4 only catches *synchronous* throws. An async handler that rejects
 * (a failed DB query, a 403 from an access check) leaves the request hanging
 * until the client times out, which reads as a mysterious network stall rather
 * than the error it actually is. Wrapping every handler funnels failures into
 * the normal error middleware instead.
 */
module.exports = function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
