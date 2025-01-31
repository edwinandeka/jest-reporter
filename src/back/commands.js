const vscode = require("vscode");
const path = require("path");
const { TestRunner } = require("./testRunner");

function registerCommands(context) {
  const disposable = vscode.commands.registerCommand(
    "extension.runJestTest",
    (fileUri) => {
      if (!fileUri || !fileUri.fsPath.endsWith(".spec.ts")) {
        vscode.window.showErrorMessage(
          "Selecciona un archivo .spec.ts para ejecutar las pruebas."
        );
        return;
      }

      const controller = vscode.tests.createTestController(
        "jestTestController",
        "Jest Tests"
      );
      const testRunner = new TestRunner(controller, context, fileUri);

      const request = new vscode.TestRunRequest([
        controller.createTestItem(
          fileUri.fsPath,
          path.basename(fileUri.fsPath),
          fileUri
        ),
      ]);
      testRunner.runTests(request);
    }
  );

  context.subscriptions.push(disposable);
}

module.exports = { registerCommands };