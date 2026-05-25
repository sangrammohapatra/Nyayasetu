/**
 * asyncHandler — wraps async Express route handlers to automatically catch
 * rejected promises and forward them to Express's next(err) error handler.
 *
 * Rule #3 (Section 15): ALL async controllers MUST use this wrapper.
 *
 * Usage:
 *   router.post('/path', asyncHandler(async (req, res) => {
 *     const data = await someAsyncOperation();
 *     res.json(data);
 *   }));
 *
 * Without this wrapper, unhandled promise rejections in route handlers
 * would silently hang the request or crash the process in Node < 15.
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
