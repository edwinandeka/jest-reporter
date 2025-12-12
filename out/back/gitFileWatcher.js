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
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTestFile = updateTestFile;
exports.addTestsToTestExplorer = addTestsToTestExplorer;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const testDiscovery_1 = require("./testDiscovery");
const utils_1 = require("./utils");
/**
 * Obtiene los archivos modificados en el repositorio Git usando git status.
 * Filtra solo archivos TypeScript (.ts) y HTML (.html).
 * @returns Array de rutas absolutas de archivos modificados.
 */
function getGitChangedFiles() {
    try {
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspacePath) {
            vscode.window.showErrorMessage('No se encontró el directorio del proyecto.');
            return [];
        }
        // Verificar si el proyecto contiene un repositorio Git
        const hasGit = fs.existsSync(path.join(workspacePath, '.git'));
        if (!hasGit) {
            vscode.window.showErrorMessage('El proyecto no es un repositorio Git.');
            return [];
        }
        // Ejecutar el comando git status --porcelain para obtener los archivos cambiados
        const output = (0, child_process_1.execSync)('git status --porcelain', {
            cwd: workspacePath,
            encoding: 'utf8',
        });
        const changedFiles = output
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line) // Filtrar líneas vacías
            .map((line) => line.split(/\s+/).pop() || '') // Extraer la ruta del archivo
            .filter((file) => file.endsWith('.ts') || file.endsWith('.html')); // Filtrar solo archivos TypeScript
        return changedFiles.map((file) => path.resolve(workspacePath, file));
    }
    catch (error) {
        vscode.window.showErrorMessage('Error al obtener los archivos modificados: ' + error.message);
        return [];
    }
}
/**
 * Limpia todos los items de prueba del controlador.
 * @param controller - El controlador de pruebas.
 */
function clearAllTests(controller) {
    // Itera sobre todos los elementos y elimínalos
    for (const [id] of controller.items) {
        controller.items.delete(id);
    }
}
/**
 * Actualiza un archivo de prueba específico en el explorador.
 * Si el archivo ya existe, lo elimina y lo vuelve a agregar con los cambios.
 * @param controller - El controlador de pruebas.
 * @param filePath - Ruta del archivo de prueba a actualizar.
 */
function updateTestFile(controller, filePath) {
    // Normalizar la ruta para Windows/Linux
    const normalizedPath = path.normalize(filePath);
    console.log(`🔄 Intentando actualizar: ${normalizedPath}`);
    // Buscar el item existente (puede estar con ruta normalizada diferente)
    let existingItem = controller.items.get(normalizedPath);
    // Si no se encuentra con la ruta normalizada, buscar manualmente
    if (!existingItem) {
        controller.items.forEach((item) => {
            if (path.normalize(item.id) === normalizedPath || item.id === normalizedPath) {
                existingItem = item;
            }
        });
    }
    // Si el archivo ya existe en el controlador, eliminarlo
    if (existingItem) {
        controller.items.delete(existingItem.id);
        console.log(`🗑️ Eliminado item anterior: ${existingItem.id}`);
    }
    // Agregar el archivo actualizado
    if (fs.existsSync(normalizedPath)) {
        (0, testDiscovery_1.discoverTests)(controller, normalizedPath);
        console.log(`✅ Archivo de prueba actualizado: ${normalizedPath}`);
    }
    else {
        console.log(`⚠️ Archivo no encontrado: ${normalizedPath}`);
    }
}
/**
 * Agrega pruebas al explorador de pruebas de VS Code.
 * Detecta archivos modificados en Git, encuentra sus archivos .spec.ts correspondientes
 * y los agrega al panel de pruebas.
 * @param controller - El controlador de pruebas.
 * @param openFilePath - Ruta del archivo actualmente abierto.
 */
function addTestsToTestExplorer(controller, openFilePath) {
    // 1) Limpia todas las pruebas existentes
    clearAllTests(controller);
    // 2) Obtiene los archivos modificados en el repositorio Git
    const changedFiles = getGitChangedFiles();
    // 3) si el openFilePath no existe en changedFiles, lo agrega
    if (openFilePath && !changedFiles.includes(openFilePath)) {
        changedFiles.push(openFilePath);
    }
    const testPaths = new Set(); // Usar un Set para evitar duplicados
    const openTestFile = (0, utils_1.getOpenTestFile)();
    // 4) Verificar si hay un archivo de pruebas abierto al inicio no existe en changedFiles, lo agregamos
    if (openTestFile && !changedFiles.includes(openTestFile.uri.fsPath)) {
        changedFiles.push(openFilePath);
    }
    // 5) Iterar sobre los archivos modificados agregar los test items
    for (const file of changedFiles) {
        if (file.endsWith('.spec.ts')) {
            // Si es un archivo .spec.ts, agrégalo al Set si no está duplicado
            if (!testPaths.has(file)) {
                testPaths.add(file);
            }
        }
        else if (file.endsWith('.ts') && !file.endsWith('.spec.ts')) {
            // Buscar el archivo .spec.ts correspondiente
            const specFile = file.replace(/\.ts$/, '.spec.ts');
            if (fs.existsSync(specFile) && !testPaths.has(specFile)) {
                testPaths.add(specFile);
            }
        }
        else if (file.endsWith('.html')) {
            // Buscar el archivo .spec.ts correspondiente
            const specFile = file.replace(/\.html$/, '.spec.ts');
            if (fs.existsSync(specFile) && !testPaths.has(specFile)) {
                testPaths.add(specFile);
            }
        }
    }
    // 6) Agregar los elementos al controlador de pruebas
    if (testPaths.size > 0) {
        for (const testPath of testPaths) {
            (0, testDiscovery_1.discoverTests)(controller, testPath);
        }
    }
    else {
        vscode.window.showInformationMessage('No se encontraron archivos de prueba asociados.');
    }
}
//# sourceMappingURL=gitFileWatcher.js.map