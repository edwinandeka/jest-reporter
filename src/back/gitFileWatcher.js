const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");
const { discoverTests } = require("./testDiscovery");
const { getOpenTestFile } = require("./utils");

/**
 * Obtiene los archivos modificados en el repositorio Git usando git status.
 * Filtra solo archivos TypeScript (.ts) y HTML (.html).
 * @returns {string[]} Array de rutas absolutas de archivos modificados.
 */
function getGitChangedFiles() {
  try {
    const workspacePath = vscode.workspace.workspaceFolders[0]?.uri.fsPath;
    if (!workspacePath) {
      vscode.window.showErrorMessage(
        "No se encontró el directorio del proyecto."
      );
      return [];
    }

    // Verificar si el proyecto contiene un repositorio Git
    const hasGit = fs.existsSync(path.join(workspacePath, ".git"));
    if (!hasGit) {
      vscode.window.showErrorMessage("El proyecto no es un repositorio Git.");
      return [];
    }

    // Ejecutar el comando git status --porcelain para obtener los archivos cambiados
    const output = execSync("git status --porcelain", {
      cwd: workspacePath,
      encoding: "utf8",
    });

    const changedFiles = output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line) // Filtrar líneas vacías
      .map((line) => line.split(/\s+/).pop()) // Extraer la ruta del archivo
      .filter((file) => file.endsWith(".ts") || file.endsWith(".html")); // Filtrar solo archivos TypeScript

    return changedFiles.map((file) => path.resolve(workspacePath, file));
  } catch (error) {
    vscode.window.showErrorMessage(
      "Error al obtener los archivos modificados: " + error.message
    );
    return [];
  }
}

/**
 * Limpia todos los items de prueba del controlador.
 * @param {vscode.TestController} controller - El controlador de pruebas.
 */
function clearAllTests(controller) {
  // Itera sobre todos los elementos y elimínalos
  for (const [id, testItem] of controller.items) {
    controller.items.delete(id);
  }
}

/**
 * Agrega pruebas al explorador de pruebas de VS Code.
 * Detecta archivos modificados en Git, encuentra sus archivos .spec.ts correspondientes
 * y los agrega al panel de pruebas.
 * @param {vscode.TestController} controller - El controlador de pruebas.
 * @param {string} openFilePath - Ruta del archivo actualmente abierto.
 */
function addTestsToTestExplorer(controller, openFilePath) {
  // 1) Limpia todas las pruebas existentes
  clearAllTests(controller);

  //2) Obtiene los archivos modificados en el repositorio Git
  const changedFiles = getGitChangedFiles();

  //3) si el openFilePath no existe en changedFiles, lo agrega
  if (openFilePath && !changedFiles.includes(openFilePath)) {
    changedFiles.push(openFilePath);
  }

  const testPaths = new Set(); // Usar un Set para evitar duplicados
  const testItems = [];

  const openTestFile = getOpenTestFile();
  // 4) Verificar si hay un archivo de pruebas abierto al inicio no existe en changedFiles, lo agregamos
  if (openTestFile && !changedFiles.includes(openTestFile.fsPath)) {
    changedFiles.push(openFilePath);
  }

  // 5) Iterar sobre los archivos modificados agregar los test items
  for (const file of changedFiles) {
    if (file.endsWith(".spec.ts")) {
      // Si es un archivo .spec.ts, agrégalo al Set si no está duplicado
      if (!testPaths.has(file)) {
        const uri = vscode.Uri.file(file);
        testPaths.add(file);
      }
    } else if (file.endsWith(".ts") && !file.endsWith(".spec.ts")) {
      // Buscar el archivo .spec.ts correspondiente
      const specFile = file.replace(/\.ts$/, ".spec.ts");
      if (fs.existsSync(specFile) && !testPaths.has(specFile)) {
        const uri = vscode.Uri.file(specFile);
        testPaths.add(specFile);
      }
    } else if (file.endsWith(".html")) {
      // Buscar el archivo .spec.ts correspondiente
      const specFile = file.replace(/\.html$/, ".spec.ts");
      if (fs.existsSync(specFile) && !testPaths.has(specFile)) {
        const uri = vscode.Uri.file(specFile);
        testPaths.add(specFile);
      }
    }
  }

  // 6) Agregar los elementos al controlador de pruebas
  if (testPaths.size > 0) {
    for (const testPath of testPaths) {
      discoverTests(controller, testPath);
      // controller.items.add(testItem);
    }
  } else {
    vscode.window.showInformationMessage(
      "No se encontraron archivos de prueba asociados."
    );
  }
}

module.exports = { addTestsToTestExplorer };
