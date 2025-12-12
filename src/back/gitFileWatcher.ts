import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { discoverTests } from './testDiscovery';
import { getOpenTestFile } from './utils';

/**
 * Obtiene los archivos modificados en el repositorio Git usando git status.
 * Filtra solo archivos TypeScript (.ts) y HTML (.html).
 * @returns Array de rutas absolutas de archivos modificados.
 */
function getGitChangedFiles(): string[] {
  try {
    const workspacePath: string | undefined = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspacePath) {
      vscode.window.showErrorMessage('No se encontró el directorio del proyecto.');
      return [];
    }

    // Verificar si el proyecto contiene un repositorio Git
    const hasGit: boolean = fs.existsSync(path.join(workspacePath, '.git'));
    if (!hasGit) {
      vscode.window.showErrorMessage('El proyecto no es un repositorio Git.');
      return [];
    }

    // Ejecutar el comando git status --porcelain para obtener los archivos cambiados
    const output: string = execSync('git status --porcelain', {
      cwd: workspacePath,
      encoding: 'utf8',
    });

    const changedFiles: string[] = output
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line) // Filtrar líneas vacías
      .map((line: string) => line.split(/\s+/).pop() || '') // Extraer la ruta del archivo
      .filter((file: string) => file.endsWith('.ts') || file.endsWith('.html')); // Filtrar solo archivos TypeScript

    return changedFiles.map((file: string) => path.resolve(workspacePath, file));
  } catch (error) {
    vscode.window.showErrorMessage(
      'Error al obtener los archivos modificados: ' + (error as Error).message
    );
    return [];
  }
}

/**
 * Limpia todos los items de prueba del controlador.
 * @param controller - El controlador de pruebas.
 */
function clearAllTests(controller: vscode.TestController): void {
  // Itera sobre todos los elementos y elimínalos
  for (const [id] of controller.items) {
    controller.items.delete(id);
  }
}

/**
 * Actualiza un archivo de prueba específico en el explorador.
 * Si el archivo ya existe, lo elimina y lo vuelve a agregar con los cambios.
 * @param controller - El controlador de pruebas.
 * @param filePath - Ruta del archivo de prueba a actualizar.
 */
export function updateTestFile(
  controller: vscode.TestController,
  filePath: string
): void {
  // Normalizar la ruta para Windows/Linux
  const normalizedPath: string = path.normalize(filePath);

  console.log(`🔄 Intentando actualizar: ${normalizedPath}`);

  // Buscar el item existente (puede estar con ruta normalizada diferente)
  let existingItem: vscode.TestItem | undefined = controller.items.get(normalizedPath);

  // Si no se encuentra con la ruta normalizada, buscar manualmente
  if (!existingItem) {
    controller.items.forEach((item: vscode.TestItem) => {
      if (path.normalize(item.id) === normalizedPath || item.id === normalizedPath) {
        existingItem = item;
      }
    });
  }

  // Si el archivo ya existe en el controlador, eliminarlo
  if (existingItem) {
    controller.items.delete(existingItem.id);
    console.log(`🗑️ Eliminado item anterior: ${existingItem.id}`);
  }

  // Agregar el archivo actualizado
  if (fs.existsSync(normalizedPath)) {
    discoverTests(controller, normalizedPath);
    console.log(`✅ Archivo de prueba actualizado: ${normalizedPath}`);
  } else {
    console.log(`⚠️ Archivo no encontrado: ${normalizedPath}`);
  }
}

/**
 * Agrega pruebas al explorador de pruebas de VS Code.
 * Detecta archivos modificados en Git, encuentra sus archivos .spec.ts correspondientes
 * y los agrega al panel de pruebas.
 * @param controller - El controlador de pruebas.
 * @param openFilePath - Ruta del archivo actualmente abierto.
 */
export function addTestsToTestExplorer(
  controller: vscode.TestController,
  openFilePath: string
): void {
  // 1) Limpia todas las pruebas existentes
  clearAllTests(controller);

  // 2) Obtiene los archivos modificados en el repositorio Git
  const changedFiles: string[] = getGitChangedFiles();

  // 3) si el openFilePath no existe en changedFiles, lo agrega
  if (openFilePath && !changedFiles.includes(openFilePath)) {
    changedFiles.push(openFilePath);
  }

  const testPaths: Set<string> = new Set<string>(); // Usar un Set para evitar duplicados

  const openTestFile: vscode.TextDocument | undefined = getOpenTestFile();
  // 4) Verificar si hay un archivo de pruebas abierto al inicio no existe en changedFiles, lo agregamos
  if (openTestFile && !changedFiles.includes(openTestFile.uri.fsPath)) {
    changedFiles.push(openFilePath);
  }

  // 5) Iterar sobre los archivos modificados agregar los test items
  for (const file of changedFiles) {
    if (file.endsWith('.spec.ts')) {
      // Si es un archivo .spec.ts, agrégalo al Set si no está duplicado
      if (!testPaths.has(file)) {
        testPaths.add(file);
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.spec.ts')) {
      // Buscar el archivo .spec.ts correspondiente
      const specFile: string = file.replace(/\.ts$/, '.spec.ts');
      if (fs.existsSync(specFile) && !testPaths.has(specFile)) {
        testPaths.add(specFile);
      }
    } else if (file.endsWith('.html')) {
      // Buscar el archivo .spec.ts correspondiente
      const specFile: string = file.replace(/\.html$/, '.spec.ts');
      if (fs.existsSync(specFile) && !testPaths.has(specFile)) {
        testPaths.add(specFile);
      }
    }
  }

  // 6) Agregar los elementos al controlador de pruebas
  if (testPaths.size > 0) {
    for (const testPath of testPaths) {
      discoverTests(controller, testPath);
    }
  } else {
    vscode.window.showInformationMessage('No se encontraron archivos de prueba asociados.');
  }
}
