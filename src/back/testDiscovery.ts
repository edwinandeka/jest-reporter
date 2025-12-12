import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Bloque describe encontrado en el archivo.
 */
interface DescribeBlock {
  name: string;
  line: number;
  testCases: Array<{
    name: string;
    line: number;
  }>;
}

/**
 * Descubre y registra las pruebas de un archivo .spec.ts en el controlador.
 * Parsea los bloques describe() e it() y crea una jerarquía de TestItems.
 * @param controller - El controlador de pruebas.
 * @param filePath - Ruta del archivo de prueba a analizar.
 */
export function discoverTests(controller: vscode.TestController, filePath: string): void {
  const fileUri: vscode.Uri = vscode.Uri.file(filePath);

  // Leer las líneas del archivo
  const lines: string[] = fs.readFileSync(filePath, 'utf8').split('\n');

  // Crear un nodo principal para el archivo
  const fileTestItem: vscode.TestItem = controller.createTestItem(filePath, path.basename(filePath), fileUri);
  controller.items.add(fileTestItem);

  // Analizar los bloques describe y it
  const tests: DescribeBlock[] = parseTestFile(lines);

  for (const describeBlock of tests) {
    const describeTestItem: vscode.TestItem = controller.createTestItem(
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
      const testItem: vscode.TestItem = controller.createTestItem(
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
 * @param lines - Array de líneas del archivo.
 * @returns Array de bloques describe encontrados.
 */
function parseTestFile(lines: string[]): DescribeBlock[] {
  const describeRegex: RegExp = /describe\(["'`](.*?)["'`]/;
  const itRegex: RegExp = /it\(["'`](.*?)["'`]/;

  const describeBlocks: DescribeBlock[] = [];
  let currentDescribe: DescribeBlock | null = null;

  lines.forEach((line: string, index: number) => {
    const describeMatch: RegExpMatchArray | null = line.match(describeRegex);
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

    const itMatch: RegExpMatchArray | null = line.match(itRegex);
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
