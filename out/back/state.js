"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Singleton para manejar el estado global de la extensión.
 * Proporciona acceso centralizado al controlador de pruebas y resultados.
 */
class ExtensionState {
    constructor() {
        this._controllerInstance = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this._testRunnerInstance = null;
        this._testResults = {};
        this._testItems = {};
        // Constructor privado para singleton
    }
    /**
     * Obtiene la instancia única del estado.
     */
    static getInstance() {
        if (!ExtensionState.instance) {
            ExtensionState.instance = new ExtensionState();
        }
        return ExtensionState.instance;
    }
    /**
     * Obtiene la instancia del controlador de pruebas.
     * @returns El controlador de pruebas o null.
     */
    getController() {
        return this._controllerInstance;
    }
    /**
     * Establece la instancia del controlador de pruebas.
     * @param controller - El controlador de pruebas.
     */
    setController(controller) {
        this._controllerInstance = controller;
    }
    /**
     * Obtiene la instancia del TestRunner.
     * @returns El TestRunner o null.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getTestRunner() {
        return this._testRunnerInstance;
    }
    /**
     * Establece la instancia del TestRunner.
     * @param testRunner - El TestRunner.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setTestRunner(testRunner) {
        this._testRunnerInstance = testRunner;
    }
    /**
     * Obtiene los resultados de las pruebas.
     * @returns Objeto con los resultados.
     */
    getTestResults() {
        return this._testResults;
    }
    /**
     * Establece los resultados de las pruebas.
     * @param results - Resultados de Jest.
     */
    setTestResults(results) {
        this._testResults = results;
    }
    /**
     * Obtiene los items de prueba.
     * @returns Objeto con los items.
     */
    getTestItems() {
        return this._testItems;
    }
    /**
     * Establece los items de prueba.
     * @param items - Items de prueba.
     */
    setTestItems(items) {
        this._testItems = items;
    }
    /**
     * Limpia todo el estado.
     */
    clear() {
        this._controllerInstance = null;
        this._testRunnerInstance = null;
        this._testResults = {};
        this._testItems = {};
    }
}
// Crear y exportar la instancia única
const state = ExtensionState.getInstance();
exports.default = state;
//# sourceMappingURL=state.js.map