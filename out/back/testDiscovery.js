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
exports.discoverTests = discoverTests;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * Descubre y registra las pruebas de un archivo .spec.ts en el controlador.
 * Parsea los bloques describe() e it() y crea una jerarquía de TestItems.
 * @param controller - El controlador de pruebas.
 * @param filePath - Ruta del archivo de prueba a analizar.
 */
function discoverTests(controller, filePath) {
    const fileUri = vscode.Uri.file(filePath);
    // Leer las líneas del archivo
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    // Crear un nodo principal para el archivo
    const fileTestItem = controller.createTestItem(filePath, path.basename(filePath), fileUri);
    controller.items.add(fileTestItem);
    // Analizar los bloques describe y it
    const tests = parseTestFile(lines);
    for (const describeBlock of tests) {
        const describeTestItem = controller.createTestItem(`${filePath}##${describeBlock.name}`, describeBlock.name, fileUri);
        describeTestItem.canResolveChildren = true;
        // 🟢 Agregar el range al bloque describe
        describeTestItem.range = new vscode.Range(new vscode.Position(describeBlock.line, 0), new vscode.Position(describeBlock.line, lines[describeBlock.line].length));
        fileTestItem.children.add(describeTestItem);
        for (const testCase of describeBlock.testCases) {
            const testItem = controller.createTestItem(`${filePath}##${testCase.name}`, testCase.name, fileUri);
            // 🟢 Agregar el range a cada it(...)
            testItem.range = new vscode.Range(new vscode.Position(testCase.line, 0), new vscode.Position(testCase.line, lines[testCase.line].length));
            describeTestItem.children.add(testItem);
        }
    }
}
/**
 * Parsea las líneas de un archivo de prueba para extraer bloques describe() e it().
 * @param lines - Array de líneas del archivo.
 * @returns Array de bloques describe encontrados.
 */
function parseTestFile(lines) {
    const describeRegex = /describe\(["'`](.*?)["'`]/;
    const itRegex = /it\(["'`](.*?)["'`]/;
    const describeBlocks = [];
    let currentDescribe = null;
    lines.forEach((line, index) => {
        const describeMatch = line.match(describeRegex);
        if (describeMatch) {
            if (currentDescribe) {
                describeBlocks.push(currentDescribe);
            }
            currentDescribe = {
                name: describeMatch[1],
                line: index,
                testCases: [],
            };
            return;
        }
        const itMatch = line.match(itRegex);
        if (itMatch && currentDescribe) {
            currentDescribe.testCases.push({
                name: itMatch[1],
                line: index,
            });
        }
    });
    if (currentDescribe) {
        describeBlocks.push(currentDescribe);
    }
    return describeBlocks;
}
//# sourceMappingURL=testDiscovery.js.map