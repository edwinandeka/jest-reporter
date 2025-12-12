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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const commands_1 = require("./commands");
const state_1 = __importDefault(require("./state"));
const gitFileWatcher_1 = require("./gitFileWatcher");
const testRunner_1 = require("./testRunner");
// Obtener la versión desde el package.json
const packageJson = require('../../package.json');
const version = packageJson.version;
/**
 * Busca archivos .spec.ts en el workspace.
 * @returns Promise con array de archivos encontrados.
 */
async function findSpecFiles() {
    // Buscar archivos .spec.ts en todo el workspace
    const specFiles = await vscode.workspace.findFiles('**/*.spec.ts', '**/node_modules/**', 100 // Limitar a 100 archivos
    );
    return specFiles;
}
/**
 * Abre el panel de pruebas de VS Code.
 */
async function openTestingPanel() {
    await vscode.commands.executeCommand('workbench.view.extension.test');
}
/**
 * Activa la extensión Jest Reporter.
 * Inicializa el controlador de pruebas y registra los comandos necesarios.
 * @param context - El contexto de activación de la extensión.
 */
async function activate(context) {
    console.log('Jest Test Explorer Activado');
    if (!state_1.default.getController()) {
        const controllerInstance = vscode.tests.createTestController('jestTestController', `Jest Reporter ${version}`);
        state_1.default.setController(controllerInstance);
        context.subscriptions.push(controllerInstance);
    }
    const controller = state_1.default.getController();
    if (controller) {
        // Crear una instancia global de TestRunner y registrar el RunProfile UNA SOLA VEZ
        const testRunner = new testRunner_1.TestRunner(controller, context);
        testRunner.registerRunProfile();
        state_1.default.setTestRunner(testRunner);
        // Registrar comandos
        (0, commands_1.registerRunJestTestCommand)(context, controller);
        (0, commands_1.registerFileSaveListener)(context, controller);
        // Buscar archivos .spec.ts en el proyecto
        const specFiles = await findSpecFiles();
        if (specFiles.length > 0) {
            console.log(`🔍 Encontrados ${specFiles.length} archivos de prueba`);
            // Verificar la configuración del usuario
            const config = vscode.workspace.getConfiguration('jestTestExplorer');
            const autoOpen = config.get('autoOpen', true);
            if (autoOpen) {
                // Agregar los archivos de prueba al explorador
                for (const specFile of specFiles.slice(0, 10)) {
                    // Limitar a 10 primeros
                    (0, gitFileWatcher_1.addTestsToTestExplorer)(controller, specFile.fsPath);
                }
                // Abrir el panel de pruebas automáticamente
                await openTestingPanel();
                console.log('✅ Panel de pruebas abierto automáticamente');
            }
        }
        else {
            console.log('ℹ️ No se encontraron archivos .spec.ts en el proyecto');
        }
    }
}
/**
 * Desactiva la extensión y limpia los recursos.
 */
function deactivate() {
    console.log('Jest Test Explorer Desactivado');
    state_1.default.clear();
}
//# sourceMappingURL=extension.js.map