"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRunJestTestCommand = registerRunJestTestCommand;
exports.registerFileSaveListener = registerFileSaveListener;
const vscode = __importStar(require("vscode"));
const gitFileWatcher_1 = require("./gitFileWatcher");
const state_1 = __importDefault(require("./state"));
const fs = __importStar(require("fs"));
/**
 * Registra el comando para ejecutar pruebas de Jest en un archivo seleccionado.
 * El comando valida que el archivo sea .spec.ts, agrega las pruebas al explorador
 * y ejecuta las pruebas usando el TestRunner global.
 * @param context - El contexto de la extensión.
 * @param controllerInstance - El controlador de pruebas de VS Code.
 */
function registerRunJestTestCommand(context, controllerInstance) {
    const disposable = vscode.commands.registerCommand('extension.runJestTest', (fileUri) => {
        if (!fileUri || !fileUri.fsPath.endsWith('.spec.ts')) {
            vscode.window.showErrorMessage('Selecciona un archivo .spec.ts para ejecutar las pruebas.');
            return;
        }
        // Agregar las pruebas al panel de pruebas
        (0, gitFileWatcher_1.addTestsToTestExplorer)(controllerInstance, fileUri.fsPath);
        // Usar la instancia global de TestRunner
        const testRunner = state_1.default.getTestRunner();
        if (testRunner) {
            testRunner.runTests(fileUri.fsPath);
        }
    });
    context.subscriptions.push(disposable);
}
/**
 * Registra un listener que detecta cuando se guarda un archivo TypeScript o HTML.
 * Automáticamente descubre y agrega pruebas relacionadas al Panel de Pruebas.
 * @param context - El contexto de la extensión.
 * @param controllerInstance - El controlador de pruebas de VS Code.
 */
function registerFileSaveListener(context, controllerInstance) {
    const disposable = vscode.workspace.onDidSaveTextDocument((document) => {
        const filePath = document.uri.fsPath;
        if (filePath.endsWith('.spec.ts')) {
            // Si es un archivo .spec.ts, actualizar solo ese archivo
            (0, gitFileWatcher_1.updateTestFile)(controllerInstance, filePath);
        }
        else if (filePath.endsWith('.ts') || filePath.endsWith('.html')) {
            // Si es un archivo .ts o .html, buscar el .spec.ts correspondiente
            const specFile = filePath.replace(/\.(ts|html)$/, '.spec.ts');
            if (fs.existsSync(specFile)) {
                (0, gitFileWatcher_1.updateTestFile)(controllerInstance, specFile);
            }
        }
    });
    context.subscriptions.push(disposable);
}
//# sourceMappingURL=commands.js.map