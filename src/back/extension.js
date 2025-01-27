const { registerCommands } = require("./commands");

/**
 * Método principal de activación de la extensión.
 * @param {vscode.ExtensionContext} context - Contexto de la extensión.
 */
function activate(context) {
  console.log("Jest Reporter activado");
  const extensionPath = context.extensionPath;

  // Llamar a registerCommands para registrar los comandos
  registerCommands(context, extensionPath);
}

/**
 * Método opcional de desactivación de la extensión.
 */
function deactivate() {
  console.log("Jest Reporter desactivado");
}

module.exports = {
  activate,
  deactivate,
};
