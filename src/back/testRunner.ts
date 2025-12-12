import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import state from './state';

/**
 * Resultado de un test individual en Jest.
 */
interface JestAssertionResult {
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'pending';
  failureMessages: string[];
  duration?: number;
}

/**
 * Resultado de un archivo de tests en Jest.
 */
interface JestTestResult {
  name: string;
  status: 'passed' | 'failed';
  assertionResults: JestAssertionResult[];
  message: string;
}

/**
 * Resultados completos de Jest.
 */
interface JestResults {
  testResults: JestTestResult[];
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  numTotalTestSuites: number;
  numPassedTests: number;
  numFailedTests: number;
  numTotalTests: number;
  snapshot: {
    total: number;
  };
  relativePath?: string;
  outputError?: string;
  fullOutput?: string;
}

/**
 * Clase que maneja la ejecución de pruebas Jest en VS Code.
 * Se encarga de ejecutar Jest, procesar los resultados y actualizar la UI.
 */
export class TestRunner {
  private controller: vscode.TestController;
  private context: vscode.ExtensionContext;
  private _fileUri: vscode.Uri;
  private panel: vscode.WebviewPanel | null = null;
  private lastTestPath: string = '';
  private lastTestTitle: string | undefined = undefined;
  private currentJestProcess: ChildProcess | null = null;

  /**
   * Crea una instancia de TestRunner.
   * @param controller - El controlador de pruebas de VS Code.
   * @param context - El contexto de la extensión.
   */
  constructor(
    controller: vscode.TestController,
    context: vscode.ExtensionContext
  ) {
    this.controller = controller;
    this.context = context;
    this._fileUri = vscode.Uri.file('');
  }

  /**
   * Registra el RunProfile para ejecutar pruebas desde el Testing Panel.
   * Este método debe llamarse UNA SOLA VEZ durante la activación de la extensión.
   */
  public registerRunProfile(): void {
    this.controller.createRunProfile(
      'Jest Reporter',
      vscode.TestRunProfileKind.Run,
      (request, token) => this.runTestsRequest(request, token),
      true
    );
  }

  /**
   * Abre un panel webview para mostrar los resultados de las pruebas.
   * @param filename - Nombre del archivo de prueba que se está ejecutando.
   */
  private openWebview(filename: string): void {
    const panel: vscode.WebviewPanel = vscode.window.createWebviewPanel(
      'webview-jest-reporter',
      `Jest-R ${filename || ''}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    // Usar la función getWebviewContent desde el módulo backend
    const { getWebviewContent } = require('./backend');
    panel.webview.html = getWebviewContent(panel, this.context.extensionPath);

    panel.webview.onDidReceiveMessage((message: any) => {
      if (message.command === 'openFile') {
        const workspacePath: string | undefined = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspacePath && message.path) {
          const { openFileAtPathAndLine } = require('./backend');
          const line: number = message.line || 1;
          openFileAtPathAndLine(message.path, line, workspacePath);
        } else if (message.path) {
          // Fallback: abrir sin línea específica
          const filePath: vscode.Uri = vscode.Uri.file(message.path);
          vscode.window.showTextDocument(filePath);
        }
      } else if (message.command === 'goToMethod') {
        const workspacePath: string | undefined = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspacePath) {
          this.findAndOpenMethod(message.specPath, message.tsPath, message.testName, workspacePath);
        }
      } else if (message.command === 'runAgain') {
        // Ejecutar las pruebas nuevamente con los mismos parámetros
        if (this.lastTestPath) {
          this.runTests(this.lastTestPath, this.lastTestTitle);
        }
      } else if (message.command === 'stopTests') {
        // Detener las pruebas en ejecución
        this.stopCurrentTests();
      } else if (message.command === 'runInTerminal') {
        // Ejecutar comando en la terminal
        this.runCommandInTerminal(message.terminalCommand);
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
   * @param request - La solicitud de ejecución.
   * @param _token - Token de cancelación (no utilizado actualmente).
   */
  private runTestsRequest(
    request: vscode.TestRunRequest,
    _token: vscode.CancellationToken
  ): void {
    if (!request.include || request.include.length === 0) {
      return;
    }

    const id: string = request.include[0].id;

    if (id.includes('##')) {
      const [file, title]: string[] = id.split('##');
      this.runTests(file, title);
    } else if (request.include[0].uri) {
      this.runTests(request.include[0].uri.fsPath);
    }
  }

  /**
   * Ejecuta las pruebas Jest para un archivo específico.
   * @param fsPath - Ruta del archivo de prueba.
   * @param title - Título específico de prueba a ejecutar (opcional).
   */
  public async runTests(fsPath: string, title?: string): Promise<void> {
    // Guardar los parámetros de la última ejecución para poder re-ejecutar
    this.lastTestPath = fsPath;
    this.lastTestTitle = title;

    this.controller.items.forEach((item: vscode.TestItem) => console.log(item.id));
    console.log('🚀 Ejecutando pruebas:', fsPath, title);

    // Obtener el testitem desde el controller
    const testItem: vscode.TestItem | undefined = this.controller.items.get(fsPath);
    if (!testItem) {
      console.error('No se encontró el test item para:', fsPath);
      return;
    }

    const request: vscode.TestRunRequest = new vscode.TestRunRequest([testItem]);

    // 1) Dar foco al Panel de Pruebas antes de iniciar la ejecución
    await vscode.commands.executeCommand('workbench.view.extension.test');

    // 2) Ejecutar las pruebas de Jest
    const run: vscode.TestRun = this.controller.createTestRun(request);
    const testItems: readonly vscode.TestItem[] = request.include || [];
    let testFiles: string[] = testItems.map((test: vscode.TestItem) => test.uri?.fsPath).filter(Boolean) as string[];

    // 3) Asegurar que las rutas sean compatibles en Windows/Linux
    testFiles = testFiles.map((filePath: string) => filePath.replace(/\\/g, '/'));

    testItems.forEach((test: vscode.TestItem) => {
      run.started(test);

      // Si tiene children es un describe también
      if (test.children.size > 0) {
        test.children.forEach((child: vscode.TestItem) => {
          run.started(child);

          // Si tiene children es un it
          if (child.children.size > 0) {
            child.children.forEach((it: vscode.TestItem) => {
              run.started(it);
            });
          }
        });
      }
    });

    // 4) Obtener el nombre del archivo de prueba o si son varios del directorio
    const filename: string = testFiles.length > 1 ? 'Some files' : path.basename(testFiles[0]);

    // Abrir el WebView si no está abierto
    if (this.panel === null) {
      this.openWebview(filename);
    }

    // ✅ Enviar los resultados al WebView con el comando completo
    const loadingData = {
      filename: filename,
      filePath: testFiles[0],
      title: title
    };
    this.sendToWebview('loading', loadingData);

    const jestPath: string | null = this.getJestPath();
    if (!jestPath) {
      run.appendOutput('⚠️ Jest no está instalado.\n');
      vscode.window.showErrorMessage('❌ Jest no encontrado. Ejecuta "npm install".');
      run.end();
      this.sendToWebview('error', 'Jest no instalado.');
      return;
    }

    const args: string[] = [
      '--json',
      '--verbose',           // Muestra más detalles de cada test
      '--testLocationInResults'  // Incluye la ubicación de cada test
    ];

    if (testFiles.length > 0) {
      args.push(...testFiles);
    }

    if (title) {
      // Ejecuta un solo `it(...)`
      args.push('-t', `"${title}"`);
    }

    console.log(`Ejecutando Jest: ${jestPath} ${args.join(' ')}`);

    const jestProcess: ChildProcess = spawn(jestPath, args, {
      cwd: vscode.workspace.workspaceFolders?.[0].uri.fsPath,
      shell: true,
    });

    // Guardar referencia del proceso actual
    this.currentJestProcess = jestProcess;

    let output: string = '';
    let outputError: string = '';

    jestProcess.stdout?.on('data', (data: Buffer) => {
      output += data.toString();
      console.log('📜 Jest Output:', data.toString());
    });

    jestProcess.stderr?.on('data', (data: Buffer) => {
      outputError += data.toString();
      console.error('⚠️ Jest Error:', data.toString());
    });

    jestProcess.on('close', (code: number | null) => {
      // Limpiar referencia del proceso
      this.currentJestProcess = null;

      // Abrir el WebView si no está abierto
      if (this.panel === null) {
        this.openWebview(filename);
      }

      if (code !== 0) {
        run.appendOutput('❌ Error al ejecutar Jest:\n' + outputError + '\n');
        testItems.forEach((test) =>
          run.failed(test, new vscode.TestMessage('Error:\n' + outputError), Date.now())
        );
        this.processJestResults(run, testFiles[0], output, outputError);
      } else {
        this.processJestResults(run, testFiles[0], output, outputError);
      }

      run.end();
    });

    jestProcess.on('error', (error: Error) => {
      run.appendOutput('❌ Error al iniciar Jest:\n' + error.message + '\n');
      vscode.window.showErrorMessage(`❌ Error al ejecutar Jest: ${error.message}`);
      testItems.forEach((test) =>
        run.failed(test, new vscode.TestMessage('Error:\n' + error.message), Date.now())
      );
      this.sendToWebview('error', `Error:\n${error.message}`);
      run.end();
    });
  }

  /**
   * Obtiene la ruta del ejecutable de Jest según el sistema operativo.
   * @returns Ruta al ejecutable de Jest o null si no existe.
   */
  private getJestPath(): string | null {
    const workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('No workspace opened!');
      return null;
    }

    const workspacePath: string = workspaceFolders[0].uri.fsPath;

    // Determinar la ruta de Jest según el sistema operativo
    const jestPath: string =
      os.platform() === 'win32'
        ? path.join(workspacePath, 'node_modules', '.bin', 'jest.cmd')
        : path.join(workspacePath, 'node_modules', '.bin', 'jest');

    if (fs.existsSync(jestPath)) {
      return jestPath;
    }

    return null;
  }

  /**
   * Procesa los resultados JSON de Jest y actualiza el estado de las pruebas.
   * @param run - La instancia de ejecución de pruebas.
   * @param _fsPath - Ruta del archivo de prueba (no utilizado actualmente).
   * @param output - Salida estándar de Jest.
   * @param outputError - Salida de error de Jest.
   */
  private processJestResults(
    run: vscode.TestRun,
    _fsPath: string,
    output: string,
    outputError: string
  ): void {
    try {
      const index: number = output.indexOf('{');
      if (index === -1) {
        const errorMsg: string = `No se pudo procesar la salida de Jest.
Salida recibida: ${output.substring(0, 200)}...
Error: ${outputError}`;
        console.error(errorMsg);
        this.sendToWebview('error', errorMsg);
        throw new Error('No se encontró un objeto JSON válido en la salida de Jest.');
      }

      const jsonString: string = output.substring(index).trim();
      let results: JestResults;

      try {
        results = JSON.parse(jsonString) as JestResults;
      } catch (parseError) {
        const errorMsg: string = `Error al parsear JSON de Jest: ${(parseError as Error).message}
Contenido recibido: ${jsonString.substring(0, 200)}...`;
        console.error(errorMsg);
        this.sendToWebview('error', errorMsg);
        throw parseError;
      }

      if (!results.testResults || !Array.isArray(results.testResults)) {
        const errorMsg: string = 'La respuesta de Jest no tiene el formato esperado (falta testResults)';
        console.error(errorMsg, results);
        this.sendToWebview('error', errorMsg);
        throw new Error(errorMsg);
      }

      // Normalizar la ruta con forward slashes para Jest (funciona en todos los OS)
      const relativePath: string = results.testResults[0].name.replace(/\\/g, '/');
      results.relativePath = relativePath;

      // Combinar stderr con los mensajes de error de cada test para mostrar el stack trace completo
      // Jest pone información valiosa en stderr que no está en el JSON
      results.outputError = outputError;

      // Guardar el output completo (incluye console.log y otros mensajes)
      results.fullOutput = output;

      // Mejorar los mensajes de error eliminando duplicados y organizando la información
      if (results.testResults) {
        results.testResults.forEach((testResult: JestTestResult) => {
          if (testResult.status === 'failed' && testResult.assertionResults) {
            testResult.assertionResults.forEach((assertion: JestAssertionResult) => {
              if (assertion.status === 'failed' && assertion.failureMessages && assertion.failureMessages.length > 0) {
                // Combinar todos los mensajes y dividir por líneas
                const allMessages = assertion.failureMessages.join('\n');
                const lines = allMessages.split('\n');

                // Filtrar líneas duplicadas manteniendo el orden
                const seenLines = new Set<string>();
                const uniqueLines: string[] = [];

                for (const line of lines) {
                  const trimmedLine = line.trim();
                  // Ignorar líneas vacías y duplicados
                  if (trimmedLine && !seenLines.has(trimmedLine)) {
                    seenLines.add(trimmedLine);
                    uniqueLines.push(line);
                  }
                }

                // Reorganizar: primero el mensaje de error principal, luego el stack trace
                const errorMessage: string[] = [];
                const stackTrace: string[] = [];
                let inStackTrace = false;

                for (const line of uniqueLines) {
                  // Detectar inicio del stack trace
                  if (line.trim().startsWith('at ') || inStackTrace) {
                    inStackTrace = true;
                    stackTrace.push(line);
                  } else {
                    errorMessage.push(line);
                  }
                }

                // Reconstruir el mensaje: error principal + stack trace organizado
                assertion.failureMessages = [
                  errorMessage.join('\n'),
                  stackTrace.length > 0 ? '\n' + stackTrace.join('\n') : ''
                ].filter(Boolean);
              }
            });
          }
        });
      }

      // ✅ Enviar los resultados al WebView
      this.sendToWebview('results', results);

      state.setTestResults(results);

      results.testResults.forEach((testFileResult: JestTestResult) => {
        const fileUri: vscode.Uri = vscode.Uri.file(testFileResult.name);

        // Procesar cada test result del archivo
        const parentTestItem: vscode.TestItem | undefined = this.controller.items.get(fileUri.fsPath);
        if (parentTestItem) {
          console.log(`Procesando pruebas del archivo: ${testFileResult.name}`);
          this.markChildTests(run, parentTestItem, testFileResult.assertionResults);
        } else {
          console.log(`⚠️ Archivo de prueba no encontrado en TestItems: ${testFileResult.name}`);
        }
      });

      run.end();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error al procesar los resultados de Jest: ${(error as Error).message}`
      );
    }
  }

  /**
   * Marca el estado de las pruebas hijas según los resultados de Jest.
   * @param run - La instancia de ejecución de pruebas.
   * @param testItem - El item de prueba padre.
   * @param results - Array de resultados de aserciones de Jest.
   */
  private markChildTests(
    run: vscode.TestRun,
    testItem: vscode.TestItem,
    results: JestAssertionResult[]
  ): void {
    // Iterar sobre los hijos del TestItem
    testItem.children.forEach((child: vscode.TestItem) => {
      child.children.forEach((childTest: vscode.TestItem) => {
        const result: JestAssertionResult | undefined = results.find((r: JestAssertionResult) => r.title === childTest.label);
        if (result) {
          switch (result.status) {
            case 'passed':
              run.passed(childTest, result.duration || 0);
              console.log(`✅ Marcado como pasado: ${child.label}`);
              break;
            case 'failed':
              {
                const message: vscode.TestMessage = new vscode.TestMessage(result.failureMessages.join('\n'));
                run.failed(childTest, message, result.duration || 0);
                console.log(`❌ Marcado como fallido: ${child.label}`);
              }
              break;
            case 'skipped':
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
   * @param command - El comando a ejecutar en el webview.
   * @param message - El mensaje o datos a enviar.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sendToWebview(command: string, message: any): void {
    if (this.panel && this.panel.webview) {
      this.panel.webview.postMessage({
        command,
        message,
      });
    }
  }

  /**
   * Busca y abre un método en el archivo TypeScript basándose en el nombre de la prueba.
   * Analiza el código de la prueba para encontrar llamadas a métodos y luego busca esos métodos en el archivo .ts
   * @param specPath - Ruta del archivo .spec.ts
   * @param tsPath - Ruta del archivo .ts correspondiente
   * @param testName - Nombre de la prueba (ej: "should create" o "HomeComponent should create")
   * @param workspacePath - Ruta del workspace
   */
  private findAndOpenMethod(specPath: string, tsPath: string, testName: string, workspacePath: string): void {
    const { openFileAtPathAndLine } = require('./backend');

    // Normalizar las rutas
    specPath = specPath.replace(/\//gm, '\\');
    tsPath = tsPath.replace(/\//gm, '\\');

    const isSpecAbsolute: boolean = path.isAbsolute(specPath);
    const isTsAbsolute: boolean = path.isAbsolute(tsPath);

    const finalSpecPath: string = isSpecAbsolute ? specPath : path.join(workspacePath, specPath);
    const finalTsPath: string = isTsAbsolute ? tsPath : path.join(workspacePath, tsPath);

    console.log('🔍 Analizando prueba en:', finalSpecPath);
    console.log('🔍 Buscando método en:', finalTsPath);
    console.log('📝 Nombre de la prueba:', testName);

    // Verificar si los archivos existen
    if (!fs.existsSync(finalSpecPath)) {
      vscode.window.showWarningMessage(`No se encontró el archivo de prueba: ${finalSpecPath}`);
      return;
    }

    if (!fs.existsSync(finalTsPath)) {
      vscode.window.showWarningMessage(`No se encontró el archivo: ${finalTsPath}`);
      return;
    }

    // 1. Leer el archivo de prueba y extraer los métodos llamados en el test específico
    const specContent: string = fs.readFileSync(finalSpecPath, 'utf8');
    const methodsCalledInTest: string[] = this.extractMethodCallsFromTest(specContent, testName);

    console.log('📞 Métodos encontrados en la prueba:', methodsCalledInTest);

    // 2. Leer el archivo TypeScript y crear un mapa de métodos con sus líneas
    const tsContent: string = fs.readFileSync(finalTsPath, 'utf8');
    const methodMap: Map<string, number> = this.buildMethodMap(tsContent);

    console.log('📋 Métodos disponibles en el archivo:', Array.from(methodMap.keys()));

    // 3. Buscar el primer método llamado en la prueba que exista en el archivo
    let foundLine: number = 0;
    let foundMethod: string = '';

    for (const methodName of methodsCalledInTest) {
      if (methodMap.has(methodName)) {
        foundLine = methodMap.get(methodName)!;
        foundMethod = methodName;
        console.log(`✅ Encontrado método "${foundMethod}" en línea ${foundLine}`);
        break;
      }
    }

    // Si no se encontró ningún método de la prueba, intentar con patrones del nombre de la prueba
    if (foundLine === 0) {
      const methodPatterns: string[] = this.extractMethodPatterns(testName);
      for (const pattern of methodPatterns) {
        if (methodMap.has(pattern)) {
          foundLine = methodMap.get(pattern)!;
          foundMethod = pattern;
          console.log(`✅ Encontrado método "${foundMethod}" por patrón en línea ${foundLine}`);
          break;
        }
      }
    }

    // Si aún no se encontró, abrir en la línea 1
    if (foundLine === 0) {
      foundLine = 1;
      console.log('⚠️ No se encontró un método específico, abriendo archivo en línea 1');
      vscode.window.showInformationMessage(`Opening ${path.basename(finalTsPath)} (no specific method found)`);
    } else {
      vscode.window.showInformationMessage(`Opening ${path.basename(finalTsPath)} at method: ${foundMethod}`);
    }

    // Abrir el archivo en la línea encontrada
    openFileAtPathAndLine(finalTsPath, foundLine, workspacePath);
  }

  /**
   * Extrae las llamadas a métodos dentro de un test específico en el archivo .spec.ts
   * Busca patrones como: component.methodName(), fixture.methodName(), service.methodName()
   * @param specContent - Contenido del archivo .spec.ts
   * @param testName - Nombre de la prueba
   * @returns Array de nombres de métodos llamados
   */
  private extractMethodCallsFromTest(specContent: string, testName: string): string[] {
    const methods: string[] = [];
    const lines: string[] = specContent.split('\n');

    // Encontrar el bloque de la prueba específica
    let inTargetTest: boolean = false;
    let braceCount: number = 0;
    let testStarted: boolean = false;

    for (let i: number = 0; i < lines.length; i++) {
      const line: string = lines[i];

      // Buscar el inicio del test: it('testName', ...
      if (line.includes(`it('${testName}'`) || line.includes(`it("${testName}"`) || line.includes(`it(\`${testName}\``)) {
        inTargetTest = true;
        testStarted = false;
      }

      if (inTargetTest) {
        // Contar llaves para saber cuándo termina el test
        const openBraces: number = (line.match(/\{/g) || []).length;
        const closeBraces: number = (line.match(/\}/g) || []).length;

        if (openBraces > 0) testStarted = true;
        braceCount += openBraces - closeBraces;

        // Extraer llamadas a métodos: component.method(), fixture.method(), etc.
        // Patrón: (component|fixture|service|instance)\.(\w+)\(
        const methodCallRegex: RegExp = /(?:component|fixture|service|instance)\.(\w+)\(/g;
        let match: RegExpExecArray | null;

        while ((match = methodCallRegex.exec(line)) !== null) {
          const methodName: string = match[1];
          if (!methods.includes(methodName)) {
            methods.push(methodName);
          }
        }

        // Si cerramos todas las llaves, terminamos el test
        if (testStarted && braceCount === 0) {
          break;
        }
      }
    }

    return methods;
  }

  /**
   * Construye un mapa de métodos y sus líneas en el archivo TypeScript
   * @param tsContent - Contenido del archivo .ts
   * @returns Map con nombre del método como clave y número de línea como valor
   */
  private buildMethodMap(tsContent: string): Map<string, number> {
    const methodMap: Map<string, number> = new Map<string, number>();
    const lines: string[] = tsContent.split('\n');

    for (let i: number = 0; i < lines.length; i++) {
      const line: string = lines[i].trim();

      // Buscar métodos: methodName() { o methodName(): type {
      // También constructor
      const methodRegex: RegExp = /^(?:public|private|protected)?\s*(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/;
      const match: RegExpMatchArray | null = line.match(methodRegex);

      if (match) {
        const methodName: string = match[1];
        if (!methodMap.has(methodName)) {
          methodMap.set(methodName, i + 1); // +1 porque las líneas empiezan en 1
          console.log(`📌 Método encontrado: ${methodName} en línea ${i + 1}`);
        }
      }
    }

    return methodMap;
  }

  /**
   * Extrae posibles patrones de nombre de método desde el nombre de una prueba.
   * @param testName - Nombre de la prueba
   * @returns Array de posibles nombres de método
   */
  private extractMethodPatterns(testName: string): string[] {
    const patterns: string[] = [];

    // Remover prefijos comunes de pruebas
    let cleanName: string = testName
      .replace(/^(should|must|can|will|does)\s+/i, '')
      .replace(/\s+(correctly|properly|successfully)$/i, '');

    // Si contiene "create", buscar constructor y ngOnInit
    if (/\bcreate\b/i.test(testName)) {
      patterns.push('constructor', 'ngOnInit');
    }

    // Convertir palabras separadas por espacios a camelCase
    // Ej: "calculate total" -> "calculateTotal"
    const words: string[] = cleanName.split(/\s+/);
    if (words.length > 1) {
      const camelCase: string = words[0].toLowerCase() + words.slice(1).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
      patterns.push(camelCase);
    }

    // Añadir la palabra principal (primera palabra significativa)
    if (words.length > 0 && words[0].length > 2) {
      patterns.push(words[0].toLowerCase());
    }

    console.log('🔎 Patrones de búsqueda:', patterns);
    return patterns;
  }

  /**
   * Detiene el proceso Jest actualmente en ejecución.
   */
  private stopCurrentTests(): void {
    if (this.currentJestProcess) {
      console.log('⏹️ Deteniendo pruebas...');
      this.currentJestProcess.kill('SIGTERM');
      this.currentJestProcess = null;
      this.sendToWebview('error', 'Tests stopped by user');
      vscode.window.showInformationMessage('Tests stopped');
    } else {
      vscode.window.showWarningMessage('No tests are currently running');
    }
  }

  /**
   * Ejecuta un comando en la terminal integrada de VS Code.
   * @param command - El comando a ejecutar.
   */
  private runCommandInTerminal(command: string): void {
    console.log('🔧 Ejecutando comando en terminal:', command);

    // Crear o reutilizar una terminal
    const terminals: readonly vscode.Terminal[] = vscode.window.terminals;
    let terminal: vscode.Terminal | undefined = terminals.find((t: vscode.Terminal) => t.name === 'Jest Reporter');

    if (!terminal) {
      terminal = vscode.window.createTerminal('Jest Reporter');
    }

    // Mostrar la terminal y ejecutar el comando
    terminal.show();
    terminal.sendText(command);
  }
}
