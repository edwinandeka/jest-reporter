import * as vscode from 'vscode';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TestResults extends Record<string, any> {}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TestItems extends Record<string, any> {}

/**
 * Singleton para manejar el estado global de la extensión.
 * Proporciona acceso centralizado al controlador de pruebas y resultados.
 */
class ExtensionState {
  private static instance: ExtensionState;
  private _controllerInstance: vscode.TestController | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _testRunnerInstance: any = null;
  private _testResults: TestResults = {};
  private _testItems: TestItems = {};

  private constructor() {
    // Constructor privado para singleton
  }

  /**
   * Obtiene la instancia única del estado.
   */
  public static getInstance(): ExtensionState {
    if (!ExtensionState.instance) {
      ExtensionState.instance = new ExtensionState();
    }
    return ExtensionState.instance;
  }

  /**
   * Obtiene la instancia del controlador de pruebas.
   * @returns El controlador de pruebas o null.
   */
  public getController(): vscode.TestController | null {
    return this._controllerInstance;
  }

  /**
   * Establece la instancia del controlador de pruebas.
   * @param controller - El controlador de pruebas.
   */
  public setController(controller: vscode.TestController): void {
    this._controllerInstance = controller;
  }

  /**
   * Obtiene la instancia del TestRunner.
   * @returns El TestRunner o null.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getTestRunner(): any {
    return this._testRunnerInstance;
  }

  /**
   * Establece la instancia del TestRunner.
   * @param testRunner - El TestRunner.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public setTestRunner(testRunner: any): void {
    this._testRunnerInstance = testRunner;
  }

  /**
   * Obtiene los resultados de las pruebas.
   * @returns Objeto con los resultados.
   */
  public getTestResults(): TestResults {
    return this._testResults;
  }

  /**
   * Establece los resultados de las pruebas.
   * @param results - Resultados de Jest.
   */
  public setTestResults(results: TestResults): void {
    this._testResults = results;
  }

  /**
   * Obtiene los items de prueba.
   * @returns Objeto con los items.
   */
  public getTestItems(): TestItems {
    return this._testItems;
  }

  /**
   * Establece los items de prueba.
   * @param items - Items de prueba.
   */
  public setTestItems(items: TestItems): void {
    this._testItems = items;
  }

  /**
   * Limpia todo el estado.
   */
  public clear(): void {
    this._controllerInstance = null;
    this._testRunnerInstance = null;
    this._testResults = {};
    this._testItems = {};
  }
}

// Crear y exportar la instancia única
const state = ExtensionState.getInstance();
export default state;
