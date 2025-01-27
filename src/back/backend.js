const fs = require("fs");
const path = require("path");
const vscode = require("vscode");

/**
 * Genera el contenido del webview cargando los archivos HTML, CSS y JS externos.
 * @param {vscode.WebviewPanel} panel - El panel del webview.
 * @param {Object} json - Resultados de los tests.
 * @param {string} relativePath - Ruta relativa del archivo de test.
 * @param {string} message - Mensaje opcional para mostrar.
 * @param {string} extensionPath - Ruta de la extensión.
 * @returns {string} - El contenido HTML del webview.
 */
function getWebviewContent(
  panel,
  json,
  relativePath,
  message,
  workspacePath,
  extensionPath
) {
  const htmlPath = path.join(extensionPath, "src", "front", "index.html");
  const htmlContent = fs.readFileSync(htmlPath, "utf8");

  const scriptUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionPath, "src", "front", "main.js"))
  );
  const styleUri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionPath, "src", "front", "main.css"))
  );

  // Inserta las rutas del CSS y JS en el HTML.
  const contentWithReplacements = htmlContent
    .replace(
      '<link rel="stylesheet" href="main.css" />',
      `<link rel="stylesheet" href="${styleUri}" />`
    )
    .replace(
      '<script src="main.js"></script>',
      `<script>JSON_RESULT = ${JSON.stringify(json)}; PAGE =  ${JSON.stringify({
        relativePath,
        message,
        workspacePath,
      })};</script><script src="${scriptUri}">JSON_RESULT = ${JSON.stringify(
        json
      )}</script>`
    );

  return contentWithReplacements;
}

/**
 * Abre un archivo en la ruta y línea especificada.
 * @param {string} filePath - Ruta completa del archivo.
 * @param {number} line - Línea a la que se debe mover el cursor.
 */
function openFileAtPathAndLine(filePath, line) {
  const openPath = vscode.Uri.file(filePath);
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
