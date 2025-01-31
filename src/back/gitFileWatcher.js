const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const vscode = require("vscode");

function getChangedFiles() {
  try {
    const workspacePath = vscode.workspace.workspaceFolders[0]?.uri.fsPath;
    if (!workspacePath) {
      vscode.window.showErrorMessage("No se encontró el directorio del proyecto.");
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
      .filter((file) => file.endsWith(".ts")); // Filtrar solo archivos TypeScript

    return changedFiles.map((file) => path.resolve(workspacePath, file));
  } catch (error) {
    vscode.window.showErrorMessage("Error al obtener los archivos modificados: " + error.message);
    return [];
  }
}

function addTestsToTestExplorer(controller) {
  const changedFiles = getChangedFiles();
  const testPaths = new Set(); // Usar un Set para evitar duplicados
  const testItems = [];

  for (const file of changedFiles) {
    if (file.endsWith(".spec.ts")) {
      // Si es un archivo .spec.ts, agrégalo al Set si no está duplicado
      if (!testPaths.has(file)) {
        const uri = vscode.Uri.file(file);
        const testItem = controller.createTestItem(uri.fsPath, path.basename(file), uri);
        testItems.push(testItem);
        testPaths.add(file);
      }
    } else if (file.endsWith(".ts") && !file.endsWith(".spec.ts")) {
      // Buscar el archivo .spec.ts correspondiente
      const specFile = file.replace(/\.ts$/, ".spec.ts");
      if (fs.existsSync(specFile) && !testPaths.has(specFile)) {
        const uri = vscode.Uri.file(specFile);
        const testItem = controller.createTestItem(uri.fsPath, path.basename(specFile), uri);
        testItems.push(testItem);
        testPaths.add(specFile);
      }
    }
  }

  // // 🔹 Agregar evento de ejecución
  // controller.createRunProfile(
  //   "Run All Tests (Git Changes)",
  //   vscode.TestRunProfileKind.Run,
  //   async (request, token) => {
  //     runAllTests();
  //   },
  //   true
  // );

  // Agregar los elementos al controlador de pruebas
  if (testItems.length > 0) {
    for (const testItem of testItems) {
      controller.items.add(testItem);
    }
  } else {
    vscode.window.showInformationMessage("No se encontraron archivos de prueba asociados.");
  }
}

module.exports = { addTestsToTestExplorer };
