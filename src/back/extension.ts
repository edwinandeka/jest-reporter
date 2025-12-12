import * as vscode from 'vscode';
import { registerRunJestTestCommand, registerFileSaveListener } from './commands';
import state from './state';
import { addTestsToTestExplorer } from './gitFileWatcher';
import { TestRunner } from './testRunner';

// Obtener la versión desde el package.json
const packageJson = require('../../package.json');
const version: string = packageJson.version;

/**
 * Busca archivos .spec.ts en el workspace.
 * @returns Promise con array de archivos encontrados.
 */
async function findSpecFiles(): Promise<vscode.Uri[]> {
  // Buscar archivos .spec.ts en todo el workspace
  const specFiles: vscode.Uri[] = await vscode.workspace.findFiles(
    '**/*.spec.ts',
    '**/node_modules/**',
    100 // Limitar a 100 archivos
  );
  return specFiles;
}

/**
 * Abre el panel de pruebas de VS Code.
 */
async function openTestingPanel(): Promise<void> {
  await vscode.commands.executeCommand('workbench.view.extension.test');
}

/**
 * Activa la extensión Jest Reporter.
 * Inicializa el controlador de pruebas y registra los comandos necesarios.
 * @param context - El contexto de activación de la extensión.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Jest Test Explorer Activado');

  if (!state.getController()) {
    const controllerInstance: vscode.TestController = vscode.tests.createTestController(
      'jestTestController',
      `Jest Reporter ${version}`
    );
    state.setController(controllerInstance);
    context.subscriptions.push(controllerInstance);
  }

  const controller: vscode.TestController | null = state.getController();
  if (controller) {
    // Crear una instancia global de TestRunner y registrar el RunProfile UNA SOLA VEZ
    const testRunner: TestRunner = new TestRunner(controller, context);
    testRunner.registerRunProfile();
    state.setTestRunner(testRunner);

    // Registrar comandos
    registerRunJestTestCommand(context, controller);
    registerFileSaveListener(context, controller);

    // Buscar archivos .spec.ts en el proyecto
    const specFiles: vscode.Uri[] = await findSpecFiles();

    if (specFiles.length > 0) {
      console.log(`🔍 Encontrados ${specFiles.length} archivos de prueba`);

      // Verificar la configuración del usuario
      const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('jestTestExplorer');
      const autoOpen: boolean = config.get<boolean>('autoOpen', true);

      if (autoOpen) {
        // Agregar los archivos de prueba al explorador
        for (const specFile of specFiles.slice(0, 10)) {
          // Limitar a 10 primeros
          addTestsToTestExplorer(controller, specFile.fsPath);
        }

        // Abrir el panel de pruebas automáticamente
        await openTestingPanel();
        console.log('✅ Panel de pruebas abierto automáticamente');
      }
    } else {
      console.log('ℹ️ No se encontraron archivos .spec.ts en el proyecto');
    }
  }
}

/**
 * Desactiva la extensión y limpia los recursos.
 */
export function deactivate(): void {
  console.log('Jest Test Explorer Desactivado');
  state.clear();
}
