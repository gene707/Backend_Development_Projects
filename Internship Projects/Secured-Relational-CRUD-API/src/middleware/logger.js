export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = (Number(end - start) / 1e6).toFixed(2);
    const statusCode = res.statusCode;

    // Terminal color formatting based on HTTP status code
    let statusColor = '\x1b[32m'; // green 2xx
    if (statusCode >= 300 && statusCode < 400) statusColor = '\x1b[36m'; // cyan 3xx
    if (statusCode >= 400 && statusCode < 500) statusColor = '\x1b[33m'; // yellow 4xx
    if (statusCode >= 500) statusColor = '\x1b[31m'; // red 5xx

    const resetColor = '\x1b[0m';
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    console.log(
      `\x1b[90m[${timestamp}]\x1b[0m \x1b[1m${req.method}\x1b[0m ${req.originalUrl} ${statusColor}${statusCode}${resetColor} - \x1b[90m${durationMs}ms\x1b[0m`
    );
  });

  next();
}
