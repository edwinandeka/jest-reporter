const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

/**
 * Descubre y registra las pruebas de un archivo .spec.ts en el controlador.
 * Parsea los bloques describe() e it() y crea una jerarquía de TestItems.
 * @param {vscode.TestController} controller - El controlador de pruebas.
 * @param {string} filePath - Ruta del archivo de prueba a analizar.
 */
function discoverTests(controller, filePath) {
  const fileUri = vscode.Uri.file(filePath);

  // Leer las líneas del archivo
  const lines = fs.readFileSync(filePath, "utf8").split("\n");

  // Crear un nodo principal para el archivo
  const fileTestItem = controller.createTestItem(
    filePath,
    path.basename(filePath),
    fileUri
  );
  controller.items.add(fileTestItem);

  // Analizar los bloques describe y it
  const tests = parseTestFile(lines);

  for (const describeBlock of tests) {
    const describeTestItem = controller.createTestItem(
      `${filePath}##${describeBlock.name}`,
      describeBlock.name,
      fileUri
    );
    describeTestItem.canResolveChildren = true;

    // 🟢 Agregar el range al bloque describe
    describeTestItem.range = new vscode.Range(
      new vscode.Position(describeBlock.line, 0),
      new vscode.Position(describeBlock.line, lines[describeBlock.line].length)
    );

    fileTestItem.children.add(describeTestItem);

    for (const testCase of describeBlock.testCases) {
      const testItem = controller.createTestItem(
        `${filePath}##${testCase.name}`,
        testCase.name,
        fileUri
      );
      // 🟢 Agregar el range a cada it(...)
      testItem.range = new vscode.Range(
        new vscode.Position(testCase.line, 0),
        new vscode.Position(testCase.line, lines[testCase.line].length)
      );

      describeTestItem.children.add(testItem);
    }
  }
}

/**
 * Parsea las líneas de un archivo de prueba para extraer bloques describe() e it().
 * @param {string[]} lines - Array de líneas del archivo.
 * @returns {Array<{name: string, line: number, testCases: Array}>} Array de bloques describe encontrados.
 */
function parseTestFile(lines) {
  const describeRegex = /describe\(["'`](.*?)["'`]/;
  const itRegex = /it\(["'`](.*?)["'`]/;

  const describeBlocks = [];
  let currentDescribe = null;

  lines.forEach((line, index) => {
    const describeMatch = line.match(describeRegex);
    if (describeMatch) {
      if (currentDescribe) {
        describeBlocks.push(currentDescribe);
      }

      currentDescribe = {
        name: describeMatch[1],
        line: index,
        testCases: [],
      };
      return;
    }

    const itMatch = line.match(itRegex);
    if (itMatch && currentDescribe) {
      currentDescribe.testCases.push({
        name: itMatch[1],
        line: index,
      });
    }
  });

  if (currentDescribe) {
    describeBlocks.push(currentDescribe);
  }

  return describeBlocks;
}

module.exports = {
  discoverTests,
};
