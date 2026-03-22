import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  serializers: {
    err: pino.stdSerializers.err,
  },
});

export function createRequestLogger() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    const requestId = crypto.randomUUID();
    req.requestId = requestId;

    res.on("finish", () => {
      logger.info({
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration: Date.now() - start,
        userId: req.session?.userId,
        organizationId: req.session?.organizationId,
      }, `${req.method} ${req.path} ${res.statusCode}`);
    });

    next();
  };
}
