var vscode = acquireVsCodeApi();

/**
 * Maneja el evento de clic para colapsar o expandir los resultados.
 * @param {Event} event - El evento de clic.
 */
function toggleResult(event) {
  const parentElement = event.target.closest(".open");
  if (parentElement) {
    parentElement.parentElement.classList.toggle("closed");
  }
}

/**
 * Envía un mensaje al backend para abrir un archivo en una línea específica.
 * @param {string} link - Enlace con la ruta y línea (formato: "path:line:column").
 */
function openFile(link) {
  link = decodeURI(link);

  console.log('🔗 openFile recibió:', link);

  // Manejar rutas de Windows que contienen ":" después de la letra de unidad (ej: F:/path)
  // Formato esperado: F:/sysgroup/.../file.ts:40:28
  let filePath = link;
  let line = 1;

  // Buscar el último ":" que precede a un número (indica línea)
  // El patrón busca: cualquier texto + : + dígitos + opcionalmente : + dígitos
  const matches = link.match(/^(.+?):(\d+)(?::(\d+))?$/);

  if (matches) {
    filePath = matches[1]; // Ruta completa del archivo
    line = parseInt(matches[2], 10); // Número de línea
    console.log('✅ Parseado correctamente - Archivo:', filePath, 'Línea:', line);
  } else {
    console.log('⚠️ No se pudo parsear el link, usando ruta completa');
  }

  vscode.postMessage({
    command: "openFile",
    path: filePath,
    line: line,
  });
}

/**
 * Abre el archivo TypeScript relacionado con las pruebas actuales.
 * @param {string} specFilePath - Ruta del archivo .spec.ts
 */
function openTsFile(specFilePath) {
  // Convertir la ruta del archivo .spec.ts al archivo .ts correspondiente
  let tsFilePath = specFilePath.replace(/\.spec\.ts$/, '.ts');

  console.log('📂 Abriendo archivo:', tsFilePath);

  vscode.postMessage({
    command: "openFile",
    path: tsFilePath,
    line: 1,
  });
}

/**
 * Abre el archivo de prueba (spec.ts).
 * @param {string} specFilePath - Ruta del archivo .spec.ts
 */
function openTestFile(specFilePath) {
  console.log('🧪 Abriendo archivo de prueba:', specFilePath);

  vscode.postMessage({
    command: "openFile",
    path: specFilePath,
    line: 1,
  });
}

/**
 * Envía un mensaje al backend para ejecutar las pruebas nuevamente.
 */
function runTestsAgain() {
  vscode.postMessage({ command: "runAgain" });
}

/**
 * Envía un mensaje al backend para ejecutar las pruebas con cobertura.
 */
function runCoverage() {
  vscode.postMessage({ command: "runCoverage" });
}

/**
 * Envía un mensaje al backend para detener las pruebas en ejecución.
 */
function stopTests() {
  vscode.postMessage({ command: "stopTests" });
}

/**
 * Envía un mensaje al backend para ejecutar un comando en la terminal.
 * @param {string} command - El comando a ejecutar.
 */
function runCommandInTerminal(command) {
  console.log('🔧 Ejecutando comando en terminal:', command);
  vscode.postMessage({ command: "runInTerminal", terminalCommand: command });
}

/**
 * Alterna la visibilidad de los resultados para mostrar solo los errores.
 * @param {Element} button - Botón que activa esta funcionalidad.
 */
function toggleErrors(button) {
  const container = document.getElementById("content-test");
  container.classList.toggle("container-closed");
  button.classList.toggle("toolbar-btn-active");
}

// Agregar event listeners a los elementos interactivos.
document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelectorAll(".open")
    .forEach((element) => element.addEventListener("click", toggleResult));

  document
    .querySelector(".toolbar-btn.run-again")
    .addEventListener("click", runTestsAgain);
  document
    .querySelector(".toolbar-btn.run-coverage")
    .addEventListener("click", runCoverage);
  document
    .querySelector(".toolbar-btn.toggle-errors")
    .addEventListener("click", function () {
      toggleErrors(this);
    });
});

/**
 * Formatea un objeto JSON y aplica estilos a las claves, valores de texto y números.
 * @param {Object} obj - El objeto que se va a formatear.
 * @returns {string} - Una cadena de HTML con el JSON resaltado.
 */
function formatObjectWithStyles(texto) {
  // Resaltar claves (en formato "clave":)
  texto = texto.replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:');

  // Resaltar valores de cadena (en formato "valor")
  texto = texto.replace(
    /: "([^"]+)"/g,
    ': <span class="json-string">"$1"</span>'
  );

  // Resaltar números
  texto = texto.replace(/: (\d+)/g, ': <span class="json-number">$1</span>');

  // Resaltar llaves `{` y `}`
  texto = texto.replace(/\{/g, '<span class="json-curly">{</span>');
  texto = texto.replace(/\}/g, '<span class="json-curly">}</span>');

  // Resaltar signos `+` y `-` en las líneas de diferencias
  texto = texto.replace(
    /(\n\s*)\+ (.+)/g,
    '$1<span class="json-plus">+ $2</span>'
  );
  texto = texto.replace(
    /(\n\s*)- (.+)/g,
    '$1<span class="json-minus">- $2</span>'
  );

  return texto;
}

// reemplaza los enlaces hacia los archivos
function replaceMessage(text, relativePath) {
  if (text.join) {
    text = text.join("\n\n");
  }

  text = text.replace(/\\/gim, "/");
  relativePath = relativePath.replace(/\\/gim, "/");

  let message = text.replace(/\x1b\[[0-9;]*m/g, "");

  // Regex mejorado para detectar rutas de archivos .ts con línea y columna
  // Formato: ruta/archivo.ts:línea:columna o ruta/archivo.ts:línea
  // Detecta rutas absolutas (Windows: C:/, D:/, etc.) o relativas
  let regex = /([A-Za-z]:\/[^\s:]+\.(?:ts|js|tsx|jsx)|(?:src|app)\/[^\s:]+\.(?:ts|js|tsx|jsx)):(\d+)(?::(\d+))?/gim;

  const matches = message.match(regex);

  if (matches) {
    for (let index = 0; index < matches.length; index++) {
      let link = matches[index].trim();
      link = link.replace(/\\/gim, "/");

      let html = `<a href="#"  onclick="openFile('${encodeURI(
        link
      )}')" >${link}</a>`;

      message = message.replace(matches[index], html);
    }
  }

  messageIndex = message.indexOf("at ");
  message =
    formatObjectWithStyles(message.substring(0, messageIndex)) +
    message.substring(messageIndex);
  message = message.replace("Error:", `<span class="test-error">Error:</span>`);

  return message;
}

function getJsonContent(json, relativePath, message) {
  let tests = json.testResults;

  const testsItems = tests
    .map((test, index) => {
      return `
            <div class="test-item ${test.status}">
            ${test.status == "failed" ? "❌" : "✅"}
            ${test.name}
            </div>
    
            <div>
              <ul>
                ${(() => {
                  let test = json.testResults[index];
                  let status = json.testResults[index].status;
                  let results = json.testResults[index].assertionResults;

                  if (!results.length) {
                    return `
                    <li class="closed ${status}">
                        <p class="open"> 
                            <span class="arrow"> < </span>   
                            <span class="${status}">${
                      status == "failed" ? "❌" : "✅"
                    }</span>
                            ${test.name}
                        </p>
                        <div class="content">
                            <pre>${replaceMessage(
                              test.message,
                              relativePath
                            )}</pre>
                        </div>
                    </li>
            `;
                  }

                  return results
                    .map((result) => {
                      return `
                    <li class="closed ${result.status}">
                        <p class="open">
                            <span class="arrow"> < </span>
                            <span class="${result.status}">${
                        result.status == "failed" ? "❌" : "✅"
                      }</span>
                            ${result.fullName}
                        </p>
                        <div class="content">
                            <pre>${replaceMessage(
                              result.failureMessages,
                              relativePath
                            )}</pre>
                        </div>
                    </li>
            `;
                    })
                    .join("");
                })()}
              </ul>
          </div>
    `;
    })
    .join("");

  const cmd = `./node_modules/.bin/jest  ${relativePath}`;

  return `
      <div id="content-test" >
        ${testsItems}
      </div>

      <div id="footer-info">
        <div class="footer-section">
          <div class="footer-cmd">cmd: <a href="#" onclick="runCommandInTerminal('${cmd.replace(/'/g, "\\'")}'); return false;" class="cmd-link">${cmd}</a></div>
        </div>
        <div class="footer-section">
          <div>Test Suites: <span class="success">${json.numPassedTestSuites} passed</span>, ${json.numTotalTestSuites} total</div>
          <div>Tests: <span class="success">${json.numPassedTests} passed</span>, ${json.numTotalTests} total</div>
        </div>
        <div class="footer-section">
          <div>Test Suites: <span class="fail">${json.numFailedTestSuites} failed</span>, ${json.numTotalTestSuites} total</div>
          <div>Tests: <span class="fail">${json.numFailedTests} failed</span>, ${json.numTotalTests} total</div>
        </div>
        <div class="footer-section">
          <div>Snapshots: ${json.snapshot.total} total</div>
        </div>
      </div>
    `;
}

/**
 * Inicializa la interfaz con los datos recibidos.
 * @param {Object} data - Datos enviados por el backend.
 */
function results(data) {
  const { message } = data;

  const content = getJsonContent(data.message, message.relativePath, message.outputError);
  document.getElementById("render").innerHTML = content;

  // Agregar event listeners a los resultados
  document.querySelectorAll(".open").forEach((element) => {
    element.addEventListener("click", toggleResult);
  });

  // Mostrar la barra de herramientas de archivo y configurar los botones
  const toolbarFile = document.getElementById("toolbar-file");
  const runAgainBtn = document.getElementById("run-again-btn");
  const openFileBtn = document.getElementById("open-file-btn");
  const openTestBtn = document.getElementById("open-test-btn");

  if (toolbarFile && runAgainBtn && openFileBtn && openTestBtn) {
    toolbarFile.classList.remove("hidden");

    // Restaurar el botón Run Again (por si estaba en modo Stop)
    runAgainBtn.innerHTML = "▶ Run Again";
    runAgainBtn.classList.remove("toolbar-file-btn-stop");

    // Remover event listeners anteriores si existen (clonando los botones)
    const newRunAgainBtn = runAgainBtn.cloneNode(true);
    runAgainBtn.parentNode.replaceChild(newRunAgainBtn, runAgainBtn);

    const newOpenFileBtn = openFileBtn.cloneNode(true);
    openFileBtn.parentNode.replaceChild(newOpenFileBtn, openFileBtn);

    const newOpenTestBtn = openTestBtn.cloneNode(true);
    openTestBtn.parentNode.replaceChild(newOpenTestBtn, openTestBtn);

    // Agregar event listeners a los botones
    newRunAgainBtn.addEventListener("click", function() {
      runTestsAgain();
    });

    newOpenFileBtn.addEventListener("click", function() {
      openTsFile(message.relativePath);
    });

    newOpenTestBtn.addEventListener("click", function() {
      openTestFile(message.relativePath);
    });
  }
}

/**
 * Inicializa la interfaz con los erroes recibidos.
 * @param {Object} data - Datos enviados por el backend.
 */
function error(data) {
  const { message } = data;

  document.getElementById("render").innerHTML = `
      <h2 style="color: red;">Error</h2>
      
      <pre>${message}</pre>
  `;
}

/**
 * Inicializa la interfaz con los datos recibidos.
 * @param {Object} data - Datos enviados por el backend.
 */
function loading(data) {
  const { message } = data;

  // Construir el comando Jest completo
  let cmd = `./node_modules/.bin/jest`;
  let displayName = message;

  if (typeof message === 'object') {
    displayName = message.filename;
    cmd = `./node_modules/.bin/jest ${message.filePath}`;
    if (message.title) {
      cmd += ` -t "${message.title}"`;
    }
  }

  document.getElementById("render").innerHTML = `
    <div id="loading" style="text-align: center; margin-top: 50px">
        <h2>Running Tests...</h2>
        <div class="spinner"></div>
        <p id="spinner-name">${displayName}</p>
      </div>

      <div id="footer-info">
        <div class="footer-section">
          <div class="footer-cmd">cmd: <a href="#" onclick="runCommandInTerminal('${cmd.replace(/'/g, "\\'")}'); return false;" class="cmd-link">${cmd}</a></div>
        </div>
        <div class="footer-section">
          <div>Status: <span class="running">In Progress...</span></div>
        </div>
      </div>
`;

  // Mostrar la barra de herramientas de archivo y cambiar el botón Run Again a Stop
  const toolbarFile = document.getElementById("toolbar-file");
  const runAgainBtn = document.getElementById("run-again-btn");

  if (toolbarFile && runAgainBtn) {
    toolbarFile.classList.remove("hidden");

    // Cambiar el botón a modo "Stop"
    runAgainBtn.innerHTML = "⬛ Stop";
    runAgainBtn.classList.add("toolbar-file-btn-stop");
    runAgainBtn.onclick = function() {
      stopTests();
    };
  }
}

/**
 * Escuchar mensajes del backend.
 */
window.addEventListener("message", (event) => {
  const { command, ...data } = event.data;

  if (command === "error") {
    error(data);
  }

  if (command === "results") {
    results(data);
  }

  if (command === "loading") {
    loading(data);
  }
});

// Enviar mensaje inicial al backend para solicitar datos
vscode.postMessage({ command: "requestData" });
