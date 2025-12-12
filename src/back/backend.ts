import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Genera el contenido HTML del webview cargando archivos externos.
 * Convierte las rutas de archivos CSS y JS a URIs seguros del webview.
 * @param panel - El panel del webview.
 * @param extensionPath - Ruta absoluta de la extensión.
 * @returns Contenido HTML completo del webview.
 */
export function getWebviewContent(panel: vscode.WebviewPanel, extensionPath: string): string {
  const htmlPath: string = path.join(extensionPath, 'src', 'front', 'index.html');
  const htmlContent: string = fs.readFileSync(htmlPath, 'utf8');

  const scriptUri: vscode.Uri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionPath, 'src', 'front', 'main.js'))
  );
  const styleUri: vscode.Uri = panel.webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionPath, 'src', 'front', 'main.css'))
  );

  return htmlContent
    .replace('<link rel="stylesheet" href="main.css" />', `<link rel="stylesheet" href="${styleUri}" />`)
    .replace('<script src="main.js"></script>', `<script src="${scriptUri}"></script>`);
}

/**
 * Abre un archivo en el editor de VS Code en una línea específica.
 * Normaliza las rutas de Windows y posiciona el cursor en la línea indicada.
 * @param filePath - Ruta relativa o completa del archivo.
 * @param line - Número de línea (base 1) donde posicionar el cursor.
 * @param workspacePath - Ruta del workspace para resolver rutas relativas.
 */
export function openFileAtPathAndLine(filePath: string, line: number, workspacePath: string): void {
  filePath = filePath.replace(/\//gm, '\\');
  const openPath: vscode.Uri = vscode.Uri.file(path.join(workspacePath, filePath));
  vscode.workspace.openTextDocument(openPath).then((doc: vscode.TextDocument) => {
    vscode.window.showTextDocument(doc).then((editor: vscode.TextEditor) => {
      const position: vscode.Position = new vscode.Position(line - 1, 0); // Línea es 1-based, posición es 0-based
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
    });
  });
}
