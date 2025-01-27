const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const spawn = require("cross-spawn");
const os = require("os");
const { getWebviewContent, openFileAtPathAndLine } = require("./backend");

/**
 * Maneja errores mostrando mensajes, registrando en consola y opcionalmente en un webview.
 * @param {Error|string} error - El error capturado.
 * @param {vscode.WebviewPanel} [panel] - Panel opcional para mostrar el error.
 */
function handleError(error, panel) {
  const message = typeof error === "string" ? error : error.message;

  // Mostrar mensaje en VS Code
  vscode.window.showErrorMessage(message);

  // Registrar en la consola de desarrollador
  console.error("Error encontrado:", error);

  // Mostrar en el webview si está disponible
  if (panel) {
    panel.webview.html = `
      <html>
        <body>
          <h2 style="color: red;">Error</h2>
          <p>${message}</p>
          <pre>${error.stack || error}</pre>
        </body>
      </html>`;
  }
}

/**
 * Ejecuta los tests en la ruta proporcionada y actualiza el panel del webview con los resultados.
 * @param {string} relativePath - Ruta relativa del archivo de test.
 * @param {vscode.WebviewPanel} panel - El panel del webview.
 */
function runTest(relativePath, panel, extensionPath) {
  const workspaceFolders = vscode.workspace.workspaceFolders;

  if (!workspaceFolders || workspaceFolders.length === 0) {
    handleError("No workspace opened!", panel);
    return;
  }

  try {
    const workspacePath = workspaceFolders[0].uri.fsPath;

    // Ajustar el path para Windows si aplica
    let jestPath = path.join(workspacePath, "node_modules", ".bin", "jest");
    if (os.platform() === "win32") {
      jestPath += ".cmd";
    }

    // Convertir rutas a formato Unix
    const relativePathUnix = relativePath.replace(/\\/g, "/");
    const workspacePathUnix = workspacePath.replace(/\\/g, "/");

    // Verificar si Jest existe
    if (!fs.existsSync(jestPath)) {
      throw new Error(`No se encontró Jest en la ruta: ${jestPath}`);
    }

    const args = [relativePathUnix, "--json"];
    console.log("Ejecutando Jest con:", {
      jestPath,
      args,
      cwd: workspacePathUnix,
    });

    const child = spawn(jestPath, args, {
      cwd: workspacePathUnix,
      shell: true,
    });

    let output = "";
    let outputError = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      outputError += data.toString();
    });

    child.on("error", (error) => {
      handleError(`Error al ejecutar Jest: ${error.message}`, panel);
    });

    child.on("close", (code) => {
      try {
        // if (code !== 0) {
        //   throw new Error(
        //     `Error al ejecutar Jest (code ${code}):\n${outputError}`
        //   );
        // }

        let index = output.indexOf("{");
        if (index === -1) {
          throw new Error("No se encontró un objeto JSON en la salida.");
        }

        const message = output.substring(0, index);
        const outputFinal = output.substring(index).trim();
        const json = JSON.parse(outputFinal);

        panel.webview.html = getWebviewContent(
          panel,
          json,
          relativePath,
          message,
          workspacePath,
          extensionPath,
        );
      } catch (error) {
        handleError(error, panel);
      }
    });
  } catch (error) {
    handleError(error, panel);
  }
}

/**
 * Registra los comandos de la extensión.
 * @param {vscode.ExtensionContext} context - Contexto de la extensión.
 * @param {string} extensionPath - Ruta base de la extensión.
 */
function registerCommands(context, extensionPath) {
  const disposable = vscode.commands.registerCommand(
    "extension.miComando",
    (argument) => {
      let filePath;

      try {
        if (argument instanceof vscode.Uri) {
          filePath = argument.fsPath;
        } else if (vscode.window.activeTextEditor) {
          filePath = vscode.window.activeTextEditor.document.uri.fsPath;
        }

        if (!filePath || !filePath.includes(".spec.ts")) {
          throw new Error(
            "Archivo no soportado. Asegúrate de seleccionar un archivo .spec.ts."
          );
        }

        const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const relativePath = path.relative(workspacePath, filePath);

        const panel = vscode.window.createWebviewPanel(
          "webview-jest-reporter",
          `Jest-R / ${path.basename(filePath)}`,
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        panel.webview.onDidReceiveMessage(
          (message) => {
            switch (message.command) {
              case "openFile":
                openFileAtPathAndLine(message.path, message.line);
                break;

              case "runAgain":
                runTest(relativePath, panel, extensionPath);
                break;

              case "runCoverage":
                vscode.window.showInformationMessage(
                  "Run coverage not implemented yet."
                );
                break;
            }
          },
          undefined,
          context.subscriptions
        );

        runTest(relativePath, panel, extensionPath);
      } catch (error) {
        handleError(error);
      }
    }
  );

  context.subscriptions.push(disposable);
}

module.exports = {
  registerCommands,
};
