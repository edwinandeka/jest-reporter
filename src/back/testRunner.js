const vscode = require("vscode");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const fs = require("fs");

class TestRunner {
  constructor(controller, context, fileUri) {
    this.controller = controller; // Panel de Pruebas
    this.context = context; // Contexto de la extensión
    this.fileUri = fileUri; // URI del archivo de prueba
    this.panel = null; // Webview Panel
  }

  openWebview(filename) {
    // ✅ Abrir el WebView cuando corran las pruebas
    const panel = vscode.window.createWebviewPanel(
      "webview-jest-reporter",
      `Jest-R ${filename || ""}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    // Usar la función getWebviewContent desde el módulo backend
    const { getWebviewContent } = require("./backend");
    panel.webview.html = getWebviewContent(panel, this.context.extensionPath);

    panel.webview.onDidReceiveMessage((message) => {
      if (message.command === "openFile") {
        const filePath = vscode.Uri.file(message.filePath);
        vscode.window.showTextDocument(filePath);
      }
    });

    // Verificar si el usuario ha cerrado el webview y limpiar la referencia
    panel.onDidDispose(() => {
      this.panel = null;
    });

    this.panel = panel;
  }

  async runTests(request, token) {
    // 🔹 Dar foco al Panel de Pruebas antes de iniciar la ejecución
    await vscode.commands.executeCommand("workbench.view.extension.test");

    // ✅ Ejecutar las pruebas de Jest
    const run = this.controller.createTestRun(request);
    const testItems = request.include || [...this.controller.items.values()];
    let testFiles = testItems.map((test) => test.uri?.fsPath).filter(Boolean);

    // Asegurar que las rutas sean compatibles en Windows/Linux
    testFiles = testFiles.map((filePath) => filePath.replace(/\\/g, "/"));

    testItems.forEach((test) => run.started(test));

    // Obtener el nombre del archivo de prueba osi son varios del directorio
    const filename =
      testFiles.length > 1 ? "Some files" : path.basename(testFiles[0]);

    // Abrir el WebView si no está abierto
    if (this.panel === null) {
      this.openWebview(filename);
    }

    // ✅ Enviar los resultados al WebView
    this.sendToWebview("loading", filename);

    const jestPath = this.getJestPath();
    if (!jestPath) {
      run.appendOutput("⚠️ Jest no está instalado.\n");
      vscode.window.showErrorMessage(
        "❌ Jest no encontrado. Ejecuta 'npm install'."
      );
      run.end();
      this.sendToWebview("error", "Jest no instalado.");
      return;
    }

    const args = ["--json", "--outputFile=jest-results.json"];
    if (testFiles.length > 0) {
      args.push(...testFiles);
    }

    console.log(`Ejecutando Jest: ${jestPath} ${args.join(" ")}`);

    const jestProcess = spawn(jestPath, args, {
      cwd: vscode.workspace.workspaceFolders[0].uri.fsPath,
      shell: true,
    });

    let output = "";
    let outputError = "";

    jestProcess.stdout.on("data", (data) => {
      output += data.toString();
      console.log("📜 Jest Output:", data.toString());
    });

    jestProcess.stderr.on("data", (data) => {
      outputError += data.toString();
      console.error("⚠️ Jest Error:", data.toString());
    });

    jestProcess.on("close", (code) => {
      // Abrir el WebView si no está abierto
      if (this.panel === null) {
        this.openWebview(filename);
      }
      // ✅ Enviar los resultados al WebView
      this.sendToWebview("loading", filename);

      if (code !== 0) {
        run.appendOutput("❌ Error al ejecutar Jest:\n" + outputError + "\n");
        testItems.forEach((test) =>
          run.failed(
            test,
            new vscode.TestMessage("Error:\n" + outputError),
            Date.now()
          )
        );
        this.processJestResults(run, testItems, outputError);
        // this.sendToWebview("error", `Error:\n${outputError}`);
      } else {
        this.processJestResults(run, testItems, outputError);
      }

      run.end();
    });

    jestProcess.on("error", (error) => {
      run.appendOutput("❌ Error al iniciar Jest:\n" + error.message + "\n");
      vscode.window.showErrorMessage(
        `❌ Error al ejecutar Jest: ${error.message}`
      );
      testItems.forEach((test) =>
        run.failed(
          test,
          new vscode.TestMessage("Error:\n" + error.message),
          Date.now()
        )
      );
      this.sendToWebview("error", `Error:\n${error.message}`);
      run.end();
    });
  }

  getJestPath() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage("No workspace opened!");
      return null;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;

    // Determinar la ruta de Jest según el sistema operativo
    const jestPath =
      os.platform() === "win32"
        ? path.join(workspacePath, "node_modules", ".bin", "jest.cmd")
        : path.join(workspacePath, "node_modules", ".bin", "jest");

    if (fs.existsSync(jestPath)) {
      return jestPath;
    }

    return null;
  }

  processJestResults(run, testItems, outputError) {
    try {
      const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const resultsPath = path.join(workspacePath, "jest-results.json");

      if (!fs.existsSync(resultsPath)) {
        throw new Error("No se encontró el archivo de resultados de Jest.");
      }

      let results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));

      const relativePath = results.testResults[0].name;
      results.relativePath = relativePath;

      // ✅ Enviar los resultados al WebView
      this.sendToWebview("results", results);

      // ✅ Enviar los resultados al Panel de Pruebas de VS Code
      console.log("Procesando resultados de Jest...");
      results.testResults.forEach((result) => {
        console.log(`Procesando prueba: ${result.name}`);
        const testItem = testItems.find(
          // tolowercase
          (item) => item.id.toLowerCase() === result.name.toLowerCase()
        );

        if (testItem) {
          console.log(`Prueba encontrada en testItems: ${testItem.label}`);
          if (result.status === "passed") {
            console.log(`Marcando como aprobada: ${testItem.label}`);
            run.passed(testItem, result.duration);
          } else if (result.status === "failed") {
            console.log(`Marcando como fallida: ${testItem.label}`);
            const messages = result.assertionResults.map(
              (assertion) =>
                new vscode.TestMessage(assertion.failureMessages.join("\n"))
            );
            run.failed(testItem, messages, result.duration);
          } else if (
            result.status === "pending" ||
            result.status === "skipped"
          ) {
            console.log(`Marcando como omitida: ${testItem.label}`);
            run.skipped(testItem);
          }
        } else {
          console.log(`Prueba no encontrada en testItems: ${result.name}`);
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error al procesar los resultados de Jest: ${error.message}`
      );
      this.sendToWebview(
        "error",
        `Error al procesar resultados: ${error.message}`
      );
    }
  }

  sendToWebview(command, message) {
    if (this.panel && this.panel.webview) {
      this.panel.webview.postMessage({
        command,
        message,
      });
    }
  }
}

module.exports = { TestRunner };
