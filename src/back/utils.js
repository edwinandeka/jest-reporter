const vscode = require("vscode");

/**
 * Obtiene el archivo de prueba actualmente abierto en el editor.
 * @returns {vscode.Uri | null} URI del archivo abierto, o null si no hay ninguno.
 */
function getOpenTestFile() {
  const openEditors = vscode.window.visibleTextEditors;
  for (const editor of openEditors) {
    const filePath = editor.document.uri.fsPath;
    if (filePath.endsWith(".spec.ts")) {
      return editor.document.uri;
    }
  }
  return null;
}

module.exports = {
  getOpenTestFile,
};
