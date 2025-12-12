/**
 * Singleton para manejar el estado global de la extensión.
 * Proporciona acceso centralizado al controlador de pruebas y resultados.
 */
class ExtensionState {
  constructor() {
    if (ExtensionState.instance) {
      return ExtensionState.instance;
    }

    this._controllerInstance = null;
    this._testResults = {};
    this._testItems = {};

    ExtensionState.instance = this;
  }

  /**
   * Obtiene la instancia del controlador de pruebas.
   * @returns {vscode.TestController | null}
   */
  getController() {
    return this._controllerInstance;
  }

  /**
   * Establece la instancia del controlador de pruebas.
   * @param {vscode.TestController} controller - El controlador de pruebas.
   */
  setController(controller) {
    this._controllerInstance = controller;
  }

  /**
   * Obtiene los resultados de las pruebas.
   * @returns {Object}
   */
  getTestResults() {
    return this._testResults;
  }

  /**
   * Establece los resultados de las pruebas.
   * @param {Object} results - Resultados de Jest.
   */
  setTestResults(results) {
    this._testResults = results;
  }

  /**
   * Obtiene los items de prueba.
   * @returns {Object}
   */
  getTestItems() {
    return this._testItems;
  }

  /**
   * Establece los items de prueba.
   * @param {Object} items - Items de prueba.
   */
  setTestItems(items) {
    this._testItems = items;
  }

  /**
   * Limpia todo el estado.
   */
  clear() {
    this._controllerInstance = null;
    this._testResults = {};
    this._testItems = {};
  }
}

// Crear y exportar la instancia única
const state = new ExtensionState();
Object.freeze(state);

module.exports = state;
