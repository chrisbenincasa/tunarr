const conf = {
  // minimumLevel: logLevel === 'silent' ? undefined : logLevel,
  translateTime: "SYS:yyyy-mm-dd'T'HH:MM:ss.l'Z'",
  singleLine: true,
  ignore: 'pid,hostname',
  customLevels: {
    http: 25,
  },
  customColors: {
    http: 'blue',
  },
  useOnlyCustomProps: false,
  messageFormat: (log, messageKey, _, { colors }) => {
    return `${colors.white(log[messageKey])}`;
  },
  customPrettifiers: {
    time: (t) => {
      return t;
    },
    level: (_level, _key, _log, { labelColorized }) => {
      return `[${labelColorized.toLowerCase()}]`;
    },
    caller: (caller, _key, _log, { colors }) => {
      return colors.green(caller);
    },
  },
  colorize: true,
};

module.exports = conf;
