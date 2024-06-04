const spawn = require("cross-spawn");
const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

function activate(context) {
  let disposable = vscode.commands.registerCommand(
    "extension.miComando",
    function (argument) {
      let filePath;
      if (argument instanceof vscode.Uri) {
        // El comando fue ejecutado desde el explorador
        filePath = argument.fsPath;
      } else if (argument instanceof vscode.TextEditor) {
        // El comando fue ejecutado desde el editor
        filePath = argument.document.uri.fsPath;
      }

      const stats = fs.statSync(filePath);

      let isFile = true;

      if (stats.isFile()) {
        isFile = true;

        if (!filePath.includes(".spec.ts")) {
          vscode.window.showErrorMessage("Archivo no soportado");
          return;
        }
      } else if (stats.isDirectory()) {
        isFile = false;
      }

      let workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      let relativePath = path.relative(workspacePath, filePath);

      // Obtener el nombre del archivo de la ruta
      let fileName = path.basename(filePath);

      workspacePath = workspacePath.replace(/\\/gim, "/");
      filePath = filePath.replace(/\\/gim, "/");
      relativePath = relativePath.replace(/\\/gim, "/");

      const panel = vscode.window.createWebviewPanel(
        "webview-jest-reporter",
        "Jest-R / " + fileName,
        vscode.ViewColumn.One,
        {
          enableScripts: true, // Permitir scripts en la vista web
          retainContextWhenHidden: true,
        }
      );

      panel.webview.onDidReceiveMessage(
        (message) => {
          switch (message.command) {
            case "openFile":
              workspacePath;
              let { path, line } = message;

              if (!path.includes(workspacePath)) {
                path = workspacePath + "/" + path;
              }

              openFileAtPathAndLine(path, line);
              return;

            case "runAgain":
              runTest(relativePath, panel);
              return;

            case "runCoverage":
              runCoverage(relativePath, panel);
              return;
          }
        },
        undefined,
        context.subscriptions
      );

      runTest(relativePath, panel);
    }
  );

  context.subscriptions.push(disposable);
}

exports.activate = activate;

var styles = `
body {
    color: #ccc;
    font-family: monospace;
    padding-top: 60px;
}

.test-item {
    font-weight: bold;
    margin-top: 16px;
    margin-bottom: 8px;
}

.arrow {
    transform: rotate(90deg);
    display: inline-block;
    font-family: cursive;
    font-weight: bold;
    font-size: 20px;
}

ul {
    list-style: none;
}

p.open {
    display: flex;
    justify-content: flex-start;
    gap: 16px;
    align-items: center;
    list-style: none;
    padding: 0px 16px;
    margin: 0;
    cursor: pointer;
    height: 22px;
}

li {
    border: 1px solid #ccc;
    margin: -1px;
}

.content {
    font-family: monospace;
    font-size: 14px;
    overflow: auto;
    padding-left: 16px;
}

.closed .content {
    display: none;
}

.closed .arrow {
    transform: rotate(-90deg);
}

li.passed .open {
    background: #0c5f5766;
}

li.failed .open {
    background: #940e0e66;
}

.toolbar {
    position: fixed;
    right: 0;
    top: 0;
    display: flex;
    justify-content: space-around;
    width: 100%;
    background: #1c1c1c;
    padding: 4px;
    box-shadow: 0 2px 5px #cccccc36;
    z-index: 999;
}
.toolbar h1 {
    margin:0;
}
.toolbar div{
    display: flex;
    gap: 8px;
}
.toolbar-btn {
    background: #fff2;
    padding: 4px 8px;
    cursor: pointer;
    border: 1px solid #fff2;
}
.toolbar-btn:hover {
    border: 1px solid #fff4;
}
.toolbar-btn:active {
    background: #fff6;
}

.toolbar-btn-active {
    background: #fff6;
}

.container-closed .closed.passed {
    display: none;
}

span.passed {
    font-size: 12px;
}

span.failed {
    font-size: 12px;
}

.hidden {
    display: none;
}

`;

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

function getWebviewContent(panel, json, relativePath, message) {
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
<!DOCTYPE html>
<html lang="en">
<head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <style>${styles}</style>
</head>
    <body>

    
    <div class="toolbar">
        <h1>Jest Reporter</h1>
        <div>
            <div class="toolbar-btn" onclick="runAgain(this)"  >
                Run again
            </div>

            <div class="toolbar-btn" onclick="toggleErrors(this)"  >
                Only errors
            </div>

            <div class="toolbar-btn hidden" onclick="runCoverage(this)"  >
            Run coverage
            </div>
        </div>
    </div>

    <div>
    
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
        <p>${message}</p>
      <div id="content-test" >
        ${testsItems}
      </div>
  

    <script>

var vscode = acquireVsCodeApi();


    function runAgain(elem) {

        vscode.postMessage({
            command: 'runAgain',
        });
    }

    function runCoverage(elem) {

        vscode.postMessage({
            command: 'runCoverage',
        });
    }

    
    

    
function toggleErrors(elem) {

    let container =  document.getElementById('content-test')

     // Alternar la clase 'closed' en el elemento padre
     container.classList.toggle('container-closed');
     elem.classList.toggle('toolbar-btn-active');
}


function miFuncion(event) {

    let elem = event.target
    let parentElement = elem.parentElement

    console.log('¡Elemento clickeado!');

     // Alternar la clase 'closed' en el elemento padre
     parentElement.classList.toggle('closed');
}

// Obtener todos los elementos con la clase 'open'
var elementos = document.getElementsByClassName('open');

// Iterar a través de cada elemento y añadir el escuchador de eventos
for(var i = 0; i < elementos.length; i++) {
    elementos[i].addEventListener('click', miFuncion);
}

function openFile(link) {
    link = decodeURI(link);
    let aux = link.split(':');

    let path = aux[0];
    let line = aux[1];

    vscode.postMessage({
        command: 'openFile',
        path: path,
        line: parseInt(line)
    });
}
    </script>
       
      </body>
      </html>
    `;
}

function getWebviewContentTerminal(testsItems) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <style>${styles}</style>
    </head>

    <body>

    <h1>Jest Reporter</h1>

      <div>
          <pre>${testsItems}</pre>
      </div>
  

       
      </body>
      </html>
    `;
}

function openFileAtPathAndLine(path, line) {
  const openPath = vscode.Uri.file(path);
  vscode.workspace.openTextDocument(openPath).then((doc) => {
    vscode.window.showTextDocument(doc).then((editor) => {
      const position = new vscode.Position(line - 1, 0); // line is 1-based, Position is 0-based
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
    });
  });
}

function runTest(relativePath, panel) {
  const cmd = `./node_modules/.bin/jest  ${relativePath}`;
  panel.webview.html = getWebviewContentTerminal(
    "Running tests...<br><br>" + cmd
  );
  setTimeout(() => {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (workspaceFolders && workspaceFolders.length > 0) {
      const workspacePath = workspaceFolders[0].uri.fsPath;
      const cmd = `${workspacePath}/node_modules/.bin/jest`;
      const args = [`${relativePath}`, `--json`];

      const child = spawn(cmd, args, {
        cwd: workspacePath,
        shell: true,
      });

      let output = "";

      child.stdout.on("data", (data) => {
        const str = data.toString();

        output += str;
      });

      child.stderr.on("data", (data) => {
        // Convertir el buffer a una cadena
        // console.log(`stderr: ${data}`);
        const str = data.toString();

        output += str;
      });

      child.on("close", (code) => {
        console.log(`child process exited with code ${code}`);

        setTimeout(() => {
          try {
            let index = output.indexOf("{");

            const message = output.substring(0, index);
            const outputFinal = output.substring(index, output.length).trim();

            // Convertir la cadena a un objeto JSON
            var json = eval(`eval(${outputFinal})`);
            // const json = JSON.parse(output);
            if (json) {
              panel.webview.html = getWebviewContent(
                panel,
                json,
                relativePath,
                message
              );
            } else {
                panel.webview.html = getWebviewContentTerminal(output);
            }

            // console.log(`stdout: ${data}`);
          } catch (error) {
            console.error(`error: `, error);
            console.log(`stdout catch: ${output}`);
          }
        }, 100);
      });

      child.on("exit", (code) => {
        console.log(`child process exited with code sdfsd ${code}`);
        panel.webview.html = getWebviewContentTerminal(output);
      });
    } else {
      vscode.window.showErrorMessage("No workspace opened!");
    }
  }, 10);
}

function runCoverage(relativePath, panel) {
  const cmd = `./node_modules/.bin/jest --coverage --collectCoverageFrom[${relativePath}] --coverageReporters=text`;
  panel.webview.html = getWebviewContentTerminal(
    "Running tests...<br><br>" + cmd
  );
  setTimeout(() => {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (workspaceFolders && workspaceFolders.length > 0) {
      const workspacePath = workspaceFolders[0].uri.fsPath;
      const cmd = `${workspacePath}/node_modules/.bin/jest`;
      const args = [
        "--coverage",
        `${relativePath}`,
        `--coverageReporters=text`,
      ];

      const child = spawn(cmd, args, {
        cwd: workspacePath,
        shell: true,
      });

      let output = "";

      child.stdout.on("data", (data) => {
        const str = data.toString();

        output += str;
      });

      child.stderr.on("data", (data) => {
        // Convertir el buffer a una cadena
        // console.log(`stderr: ${data}`);
        const str = data.toString();
        

        output += str;
      });

      child.on("close", (code) => {
        console.log(`child process exited with code ${code}`);
        

        panel.webview.html = getWebviewContentTerminal(output);
      });

      child.on("exit", (code) => {
        console.log(`child process exited with code sdfsd ${code}`);

        panel.webview.html = getWebviewContentTerminal(output);
      });
    } else {
      vscode.window.showErrorMessage("No workspace opened!");
    }
  }, 10);
}
