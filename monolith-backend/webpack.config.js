module.exports = (config) => {
  const checkerPlugin = config.plugins.find(
    (plugin) => plugin.constructor.name === 'ForkTsCheckerWebpackPlugin',
  );

  if (checkerPlugin) {
    checkerPlugin.options.typescript.memoryLimit = 4096;
  }

  return config;
};