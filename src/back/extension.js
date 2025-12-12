const vscode = require("vscode");
const {
  registerRunJestTestCommand,
  registerFileSaveListener,
} = require("./commands");
const state = require("./state");

// Obtener la versión desde el package.json
const packageJson = require("../../package.json");
const version = packageJson.version;

/**
 * Activa la extensión Jest Reporter.
 * Inicializa el controlador de pruebas y registra los comandos necesarios.
 * @param {vscode.ExtensionContext} context - El contexto de activación de la extensión.
 */
function activate(context) {
  console.log("Jest Test Explorer Activado");

  if (!state.getController()) {
    const controllerInstance = vscode.tests.createTestController(
      "jestTestController",
      "Jest Reporter " + version
    );
    state.setController(controllerInstance);
    context.subscriptions.push(controllerInstance);
  }

  // Registrar comandos
  registerRunJestTestCommand(context, state.getController());
  registerFileSaveListener(context, state.getController());
}

/**
 * Desactiva la extensión y limpia los recursos.
 */
function deactivate() {
  console.log("Jest Test Explorer Desactivado");
  state.clear();
}

module.exports = {
  activate,
  deactivate,
};
