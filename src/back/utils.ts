import * as vscode from 'vscode';

/**
 * Obtiene el archivo de prueba actualmente abierto en el editor.
 * @returns TextDocument del archivo abierto, o undefined si no hay ninguno.
 */
export function getOpenTestFile(): vscode.TextDocument | undefined {
  const openEditors: readonly vscode.TextEditor[] = vscode.window.visibleTextEditors;
  for (const editor of openEditors) {
    const filePath: string = editor.document.uri.fsPath;
    if (filePath.endsWith('.spec.ts')) {
      return editor.document;
    }
  }
  return undefined;
}
