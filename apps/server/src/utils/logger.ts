const isProduction = process.env.NODE_ENV === "production";
let isLoggingEnabled = !isProduction;

export const logger = {
  enable: () => {
    isLoggingEnabled = true;
  },

  disable: () => {
    isLoggingEnabled = false;
  },

  log: (...args: unknown[]) => {
    if (isLoggingEnabled) {
      console.log(...args);
    }
  },

  // Additional logging levels if needed
  debug: (...args: unknown[]) => {
    if (isLoggingEnabled) {
      console.debug(...args);
    }
  },

  error: (...args: unknown[]) => {
    if (isProduction) {
      const sanitized = args.map((arg) =>
        arg instanceof Error ? arg.message : arg,
      );
      console.error(...sanitized);
    } else {
      console.error(...args);
    }
  },

  warn: (...args: unknown[]) => {
    if (isLoggingEnabled) {
      console.warn(...args);
    }
  },

  info: (...args: unknown[]) => {
    if (isLoggingEnabled) {
      console.info(...args);
    }
  },
};
