import * as vscode from 'vscode';
import { addTestsToTestExplorer, updateTestFile } from './gitFileWatcher';
import state from './state';
import * as fs from 'fs';

/**
 * Registra el comando para ejecutar pruebas de Jest en un archivo seleccionado.
 * El comando valida que el archivo sea .spec.ts, agrega las pruebas al explorador
 * y ejecuta las pruebas usando el TestRunner global.
 * @param context - El contexto de la extensión.
 * @param controllerInstance - El controlador de pruebas de VS Code.
 */
export function registerRunJestTestCommand(
  context: vscode.ExtensionContext,
  controllerInstance: vscode.TestController
): void {
  const disposable = vscode.commands.registerCommand(
    'extension.runJestTest',
    (fileUri: vscode.Uri) => {
      if (!fileUri || !fileUri.fsPath.endsWith('.spec.ts')) {
        vscode.window.showErrorMessage(
          'Selecciona un archivo .spec.ts para ejecutar las pruebas.'
        );
        return;
      }

      // Agregar las pruebas al panel de pruebas
      addTestsToTestExplorer(controllerInstance, fileUri.fsPath);

      // Usar la instancia global de TestRunner
      const testRunner = state.getTestRunner();
      if (testRunner) {
        testRunner.runTests(fileUri.fsPath);
      }
    }
  );

  context.subscriptions.push(disposable);
}

/**
 * Registra un listener que detecta cuando se guarda un archivo TypeScript o HTML.
 * Automáticamente descubre y agrega pruebas relacionadas al Panel de Pruebas.
 * @param context - El contexto de la extensión.
 * @param controllerInstance - El controlador de pruebas de VS Code.
 */
export function registerFileSaveListener(
  context: vscode.ExtensionContext,
  controllerInstance: vscode.TestController
): void {
  const disposable: vscode.Disposable = vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    const filePath: string = document.uri.fsPath;

    if (filePath.endsWith('.spec.ts')) {
      // Si es un archivo .spec.ts, actualizar solo ese archivo
      updateTestFile(controllerInstance, filePath);
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.html')) {
      // Si es un archivo .ts o .html, buscar el .spec.ts correspondiente
      const specFile: string = filePath.replace(/\.(ts|html)$/, '.spec.ts');
      if (fs.existsSync(specFile)) {
        updateTestFile(controllerInstance, specFile);
      }
    }
  });
  context.subscriptions.push(disposable);
}
