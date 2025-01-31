const vscode = require("vscode");
const path = require("path");
const { registerCommands } = require("./commands");
const { TestRunner } = require("./testRunner");
const { addTestsToTestExplorer } = require("./gitFileWatcher");

function getOpenTestFile() {
  const openEditors = vscode.window.visibleTextEditors;
  for (const editor of openEditors) {
    const filePath = editor.document.uri.fsPath;
    if (filePath.endsWith(".spec.ts")) {
      return editor.document.uri;
    }
  }
  return null;
}

function activate(context) {
  console.log("Jest Test Explorer Activado");

  const controller = vscode.tests.createTestController(
    "jestTestController",
    "Jest Tests"
  );
  context.subscriptions.push(controller);

  const testRunner = new TestRunner(controller, context);

  // Verificar si hay un archivo de pruebas abierto al inicio
  const openTestFile = getOpenTestFile();
  if (openTestFile) {
    // Crear una solicitud de prueba para el archivo abierto
    const request = new vscode.TestRunRequest([
      controller.createTestItem(
        openTestFile.fsPath,
        path.basename(openTestFile.fsPath),
        openTestFile
      ),
    ]);
    testRunner.runTests(request);
  }

  // Crear el perfil de ejecución de pruebas
  controller.createRunProfile(
    "Jest Reporter",
    vscode.TestRunProfileKind.Run,
    (request, token) => testRunner.runTests(request, token),
    true
  );

  // Agregar pruebas automáticamente si hay archivos en el repositorio Git
  addTestsToTestExplorer(controller);

  // Registrar comandos correctamente
  registerCommands(context);

  const disposable = vscode.workspace.onDidSaveTextDocument((document) => {
    if (
      document.fileName.endsWith(".ts") ||
      document.fileName.endsWith(".html")
    ) {
      addTestsToTestExplorer(controller);
    }
  });

  context.subscriptions.push(disposable);
}

function deactivate() {
  console.log("Jest Test Explorer Desactivado");
}

module.exports = {
  activate,
  deactivate,
};
