const { ZodError } = require('zod');

function errorHandler(err, req, res, next) {
  console.error(err);

  if (err instanceof ZodError) {
    const issues = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }));

    return res.status(400).json({
      error: issues[0]?.message || 'Please check the submitted details.',
      code: 'VALIDATION_ERROR',
      issues
    });
  }

  const status = err.status || 500;

  res.status(status).json({
    error: err.publicMessage || 'Internal server error',
    detail: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
}

module.exports = errorHandler;
