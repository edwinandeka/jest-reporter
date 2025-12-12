const vscode = require("vscode");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const fs = require("fs");
const state = require("./state");

/**
 * Clase que maneja la ejecución de pruebas Jest en VS Code.
 * Se encarga de ejecutar Jest, procesar los resultados y actualizar la UI.
 */
class TestRunner {
  /**
   * Crea una instancia de TestRunner.
   * @param {vscode.TestController} controller - El controlador de pruebas de VS Code.
   * @param {vscode.ExtensionContext} context - El contexto de la extensión.
   * @param {vscode.Uri} fileUri - URI del archivo de prueba a ejecutar.
   */
  constructor(controller, context, fileUri) {
    this.controller = controller; // Panel de Pruebas
    this.context = context; // Contexto de la extensión
    this.fileUri = fileUri; // URI del archivo de prueba
    this.panel = null; // Webview Panel

    // Registrar el RunProfile para Jest
    this.controller.createRunProfile(
      "Jest Reporter",
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runTestsRequest(request, token),
      true
    );
  }

  /**
   * Abre un panel webview para mostrar los resultados de las pruebas.
   * @param {string} filename - Nombre del archivo de prueba que se está ejecutando.
   */
  openWebview(filename) {
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

  /**
   * Procesa una solicitud de ejecución de pruebas desde el panel de VS Code.
   * @param {vscode.TestRunRequest} request - La solicitud de ejecución.
   * @param {vscode.CancellationToken} token - Token de cancelación.
   */
  runTestsRequest(request, token) {
    const id = request.include[0].id;

    if (id.includes("##")) {
      const [file, title] = id.split("##");
      this.runTests(file, title);
    } else {
      this.runTests(request.include[0].uri.fsPath);
    }
  }

  /**
   * Ejecuta las pruebas Jest para un archivo específico.
   * @param {string} fsPath - Ruta del archivo de prueba.
   * @param {string} [title] - Título específico de prueba a ejecutar (opcional).
   */
  async runTests(fsPath, title) {
    this.controller.items.forEach((item) => console.log(item.id));
    console.log("🚀 Ejecutando pruebas:", fsPath, title);
    // obtener el testitem desde el controller
    const testItem = this.controller.items.get(fsPath);
    const request = new vscode.TestRunRequest([testItem]);

    // 1) Dar foco al Panel de Pruebas antes de iniciar la ejecución
    await vscode.commands.executeCommand("workbench.view.extension.test");

    // 2) Ejecutar las pruebas de Jest
    const run = this.controller.createTestRun(request);
    const testItems = request.include;
    let testFiles = testItems.map((test) => test.uri?.fsPath).filter(Boolean);

    // 3) Asegurar que las rutas sean compatibles en Windows/Linux
    testFiles = testFiles.map((filePath) => filePath.replace(/\\/g, "/"));

    testItems.forEach((test) => {
      run.started(test);

      // si tiene children es un describe tambien
      if (test.children.size > 0) {
        test.children.forEach((child) => {
          run.started(child);

          // si tiene children es un it
          if (child.children.size > 0) {
            child.children.forEach((it) => {
              run.started(it);
            });
          }
        });
      }
    });

    // 4) Obtener el nombre del archivo de prueba o si son varios del directorio
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

    const args = ["--json"];
    if (testFiles.length > 0) {
      args.push(...testFiles);
    }

    if (title) {
      // Ejecuta un solo `it(...)`
      args.push("-t", `"${title}"`);
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
        this.processJestResults(run, testFiles[0], output, outputError);
      } else {
        this.processJestResults(run, testFiles[0], output, outputError);
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

  /**
   * Obtiene la ruta del ejecutable de Jest según el sistema operativo.
   * @returns {string | null} Ruta al ejecutable de Jest o null si no existe.
   */
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

  /**
   * Procesa los resultados JSON de Jest y actualiza el estado de las pruebas.
   * @param {vscode.TestRun} run - La instancia de ejecución de pruebas.
   * @param {string} fsPath - Ruta del archivo de prueba.
   * @param {string} output - Salida estándar de Jest.
   * @param {string} outputError - Salida de error de Jest.
   */
  processJestResults(run, fsPath, output, outputError) {
    try {
      const index = output.indexOf("{");
      if (index === -1) {
        const errorMsg = `No se pudo procesar la salida de Jest.
Salida recibida: ${output.substring(0, 200)}...
Error: ${outputError}`;
        console.error(errorMsg);
        this.sendToWebview("error", errorMsg);
        throw new Error("No se encontró un objeto JSON válido en la salida de Jest.");
      }

      const jsonString = output.substring(index).trim();
      let results;

      try {
        results = JSON.parse(jsonString);
      } catch (parseError) {
        const errorMsg = `Error al parsear JSON de Jest: ${parseError.message}
Contenido recibido: ${jsonString.substring(0, 200)}...`;
        console.error(errorMsg);
        this.sendToWebview("error", errorMsg);
        throw parseError;
      }

      if (!results.testResults || !Array.isArray(results.testResults)) {
        const errorMsg = "La respuesta de Jest no tiene el formato esperado (falta testResults)";
        console.error(errorMsg, results);
        this.sendToWebview("error", errorMsg);
        throw new Error(errorMsg);
      }

      const relativePath = results.testResults[0].name;
      results.relativePath = relativePath;
      results.outputError = outputError;

      // ✅ Enviar los resultados al WebView
      this.sendToWebview("results", results);

      state.setTestResults(results);

      results.testResults.forEach((testFileResult) => {
        const fileUri = vscode.Uri.file(testFileResult.name);

        // Procesar cada test result del archivo
        const parentTestItem = this.controller.items.get(fileUri.fsPath);
        if (parentTestItem) {
          console.log(`Procesando pruebas del archivo: ${testFileResult.name}`);
          this.markChildTests(
            run,
            parentTestItem,
            testFileResult.assertionResults
          );
        } else {
          console.log(
            `⚠️ Archivo de prueba no encontrado en TestItems: ${testFileResult.name}`
          );
        }
      });

      run.end();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error al procesar los resultados de Jest: ${error.message}`
      );
    }
  }

  /**
   * Marca el estado de las pruebas hijas según los resultados de Jest.
   * @param {vscode.TestRun} run - La instancia de ejecución de pruebas.
   * @param {vscode.TestItem} testItem - El item de prueba padre.
   * @param {Array} results - Array de resultados de aserciones de Jest.
   */
  markChildTests(run, testItem, results) {
    // Iterar sobre los hijos del TestItem
    testItem.children.forEach((child) => {
      child.children.forEach((childTest) => {
        const result = results.find((r) => r.title === childTest.label);
        if (result) {
          switch (result.status) {
            case "passed":
              run.passed(childTest, result.duration || 0);
              console.log(`✅ Marcado como pasado: ${child.label}`);
              break;
            case "failed":
              const message = new vscode.TestMessage(
                result.failureMessages.join("\n")
              );
              run.failed(childTest, message, result.duration || 0);
              console.log(`❌ Marcado como fallido: ${child.label}`);
              break;
            case "skipped":
              run.skipped(childTest);
              console.log(`⏭️ Marcado como omitido: ${child.label}`);
              break;
          }
        } else {
          console.log(`⚠️ Resultado no encontrado para: ${child.label}`);
        }
      });
    });
  }

  /**
   * Envía un mensaje al webview.
   * @param {string} command - El comando a ejecutar en el webview.
   * @param {any} message - El mensaje o datos a enviar.
   */
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
