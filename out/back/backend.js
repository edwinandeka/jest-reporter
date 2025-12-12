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
exports.getWebviewContent = getWebviewContent;
exports.openFileAtPathAndLine = openFileAtPathAndLine;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
/**
 * Genera el contenido HTML del webview cargando archivos externos.
 * Convierte las rutas de archivos CSS y JS a URIs seguros del webview.
 * @param panel - El panel del webview.
 * @param extensionPath - Ruta absoluta de la extensión.
 * @returns Contenido HTML completo del webview.
 */
function getWebviewContent(panel, extensionPath) {
    const htmlPath = path.join(extensionPath, 'src', 'front', 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(extensionPath, 'src', 'front', 'main.js')));
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.file(path.join(extensionPath, 'src', 'front', 'main.css')));
    return htmlContent
        .replace('<link rel="stylesheet" href="main.css" />', `<link rel="stylesheet" href="${styleUri}" />`)
        .replace('<script src="main.js"></script>', `<script src="${scriptUri}"></script>`);
}
/**
 * Abre un archivo en el editor de VS Code en una línea específica.
 * Normaliza las rutas de Windows y posiciona el cursor en la línea indicada.
 * @param filePath - Ruta relativa o absoluta del archivo.
 * @param line - Número de línea (base 1) donde posicionar el cursor.
 * @param workspacePath - Ruta del workspace para resolver rutas relativas.
 */
function openFileAtPathAndLine(filePath, line, workspacePath) {
    // Normalizar la ruta
    filePath = filePath.replace(/\//gm, '\\');
    // Determinar si es una ruta absoluta (contiene : en Windows o empieza con / en Unix)
    const isAbsolute = path.isAbsolute(filePath);
    // Si es relativa, unirla con workspacePath; si es absoluta, usarla directamente
    const finalPath = isAbsolute ? filePath : path.join(workspacePath, filePath);
    const openPath = vscode.Uri.file(finalPath);
    vscode.workspace.openTextDocument(openPath).then((doc) => {
        vscode.window.showTextDocument(doc).then((editor) => {
            const position = new vscode.Position(line - 1, 0); // Línea es 1-based, posición es 0-based
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position));
        });
    });
}
//# sourceMappingURL=backend.js.map