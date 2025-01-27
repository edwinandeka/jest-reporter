var vscode = acquireVsCodeApi();

JSON_RESULT;

debugger;

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
 * @param {string} link - Enlace con la ruta y línea (formato: "path:line").
 */
function openFile(link) {
  link = decodeURI(link);
  const [filePath, line] = link.split(":");

  vscode.postMessage({
    command: "openFile",
    path: filePath,
    line: parseInt(line),
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

// reemplaza los enlaces hacia los archivos
function replaceMessage(text, relativePath) {
  if (text.join) {
    text = text.join("\n\n");
  }

  text = text.replace(/\\/gim, "/");

  let message = text.replace(/\x1b\[[0-9;]*m/g, "");

  let regex = new RegExp(relativePath + "\\s*(.+?):(\\d+)", "gmi");

  const matches = message.match(regex);

  if (matches) {
    for (let index = 0; index < matches.length; index++) {
      const link = matches[index];

      let html = `<a href="#"  onclick="openFile('${encodeURI(
        link
      )}')" >${link}</a>`;

      message = message.replace(link, html);
    }
  }

  return message;
}

function getJsonContent() {
  const json = JSON_RESULT;
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
                              PAGE.relativePath
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
                              PAGE.relativePath
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

  const cmd = `./node_modules/.bin/jest  ${PAGE.relativePath}`;

  return `
        <div>cmd: ${cmd}</div>
        <div>Test Suites: ${json.numPassedTestSuites} passed, ${json.numTotalTestSuites} total</div>
        <div>Tests:       ${json.numPassedTests} passed, ${json.numTotalTests} total</div>
        <br>
        <div>Test Suites: ${json.numFailedTestSuites} failed, ${json.numTotalTestSuites} total</div>
        <div>Tests:       ${json.numFailedTests} failed, ${json.numTotalTests} total</div>
        <br>
        <div>Snapshots:   ${json.snapshot.total} total</div>
        <div>Time:        7.248 s</div>
    </div>
        <p>${PAGE.message}</p>
      <div id="content-test" >
        ${testsItems}
      </div>
    `;
}

if (JSON_RESULT) {
  const content = getJsonContent();
  document.getElementById("render").innerHTML = content;
}
