const vscode = require("vscode");
const { TestRunner } = require("./testRunner");
const { addTestsToTestExplorer } = require("./gitFileWatcher");

/**
 * Registra el comando para ejecutar pruebas de Jest en un archivo seleccionado.
 * El comando valida que el archivo sea .spec.ts, agrega las pruebas al explorador
 * y ejecuta las pruebas usando TestRunner.
 * @param {vscode.ExtensionContext} context - El contexto de la extensión.
 * @param {vscode.TestController} controllerInstance - El controlador de pruebas de VS Code.
 */
function registerRunJestTestCommand(context, controllerInstance) {
  const disposable = vscode.commands.registerCommand(
    "extension.runJestTest",
    (fileUri) => {
      if (!fileUri || !fileUri.fsPath.endsWith(".spec.ts")) {
        vscode.window.showErrorMessage(
          "Selecciona un archivo .spec.ts para ejecutar las pruebas."
        );
        return;
      }

      // Agregar las pruebas al panel de pruebas
      addTestsToTestExplorer(controllerInstance, fileUri.fsPath);

      const testRunner = new TestRunner(controllerInstance, context, fileUri);
      testRunner.runTests(fileUri.fsPath);
    }
  );

  context.subscriptions.push(disposable);
}

/**
 * Registra un listener que detecta cuando se guarda un archivo TypeScript o HTML.
 * Automáticamente descubre y agrega pruebas relacionadas al Panel de Pruebas.
 * @param {vscode.ExtensionContext} context - El contexto de la extensión.
 * @param {vscode.TestController} controllerInstance - El controlador de pruebas de VS Code.
 */
function registerFileSaveListener(context, controllerInstance) {
  const disposable = vscode.workspace.onDidSaveTextDocument((document) => {
    if (
      document.fileName.endsWith(".ts") ||
      document.fileName.endsWith(".html")
    ) {
      addTestsToTestExplorer(controllerInstance, document.uri.fsPath);
    }
  });
  context.subscriptions.push(disposable);
}

module.exports = {
  registerRunJestTestCommand,
  registerFileSaveListener,
};
