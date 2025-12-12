const fs = require("fs");
const path = require("path");
const vscode = require("vscode");

/**
 * Genera el contenido HTML del webview cargando archivos externos.
 * Convierte las rutas de archivos CSS y JS a URIs seguros del webview.
 * @param {vscode.WebviewPanel} panel - El panel del webview.
 * @param {string} extensionPath - Ruta absoluta de la extensión.
 * @returns {string} Contenido HTML completo del webview.
 */
function getWebviewContent(panel, extensionPath) {
  const htmlPath = path.join(extensionPath, "src", "front", "index.html");
  const htmlContent = fs.readFileSync(htmlPath, "utf8");

  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionPath, "src", "front", "main.js"))
  );
  const styleUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionPath, "src", "front", "main.css"))
  );

  return htmlContent
    .replace(
      '<link rel="stylesheet" href="main.css" />',
      `<link rel="stylesheet" href="${styleUri}" />`
    )
    .replace(
      '<script src="main.js"></script>',
      `<script src="${scriptUri}"></script>`
    );
}

/**
 * Abre un archivo en el editor de VS Code en una línea específica.
 * Normaliza las rutas de Windows y posiciona el cursor en la línea indicada.
 * @param {string} filePath - Ruta relativa o completa del archivo.
 * @param {number} line - Número de línea (base 1) donde posicionar el cursor.
 * @param {string} workspacePath - Ruta del workspace para resolver rutas relativas.
 */
function openFileAtPathAndLine(filePath, line, workspacePath) {
  filePath = filePath.replace(/\//gm, "\\");
  const openPath = vscode.Uri.file(path.join(workspacePath, filePath));
  vscode.workspace.openTextDocument(openPath).then((doc) => {
    vscode.window.showTextDocument(doc).then((editor) => {
      const position = new vscode.Position(line - 1, 0); // Línea es 1-based, posición es 0-based
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
    });
  });
}

module.exports = {
  getWebviewContent,
  openFileAtPathAndLine,
};
