const spawn = require('cross-spawn');
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

function activate(context) {
    let disposable = vscode.commands.registerCommand(
        'extension.miComando',
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

                if (!filePath.includes('.spec.ts')) {
                    vscode.window.showErrorMessage('Archivo no soportado');
                    return;
                }
            } else if (stats.isDirectory()) {
                isFile = false;
            }

            let workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            let relativePath = path.relative(workspacePath, filePath);

            // Obtener el nombre del archivo de la ruta
            let fileName = path.basename(filePath);

            workspacePath = workspacePath.replace(/\\/gim, '/');
            filePath = filePath.replace(/\\/gim, '/');
            relativePath = relativePath.replace(/\\/gim, '/');

            const cmd = `./node_modules/.bin/jest  ${relativePath}`;

            const panel = vscode.window.createWebviewPanel(
                'webview-jest-reporter',
                'Jest-R / ' + fileName,
                vscode.ViewColumn.One,
                {
                    enableScripts: true, // Permitir scripts en la vista web
                    retainContextWhenHidden: true,
                }
            );

            const scriptPathOnDisk = vscode.Uri.file(
                path.join(context.extensionPath, 'public', 'js', 'script.js')
            );

            const scriptUri = panel.webview.asWebviewUri(scriptPathOnDisk);
            // panel.webview.html = getWebviewContent(panel,scriptUri, null);

            panel.webview.html = getWebviewContentTerminal(
                'Running tests...<br><br>' + cmd
            );

            panel.webview.onDidReceiveMessage(
                (message) => {
                    switch (message.command) {
                        case 'openFile':
                            const { path, line } = message;
                            openFileAtPathAndLine(path, line);
                            return;
                    }
                },
                undefined,
                context.subscriptions
            );

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const workspacePath = workspaceFolders[0].uri.fsPath;
                const cmd = `${workspacePath}/node_modules/.bin/jest`;
                const args = [`${relativePath}`, `--json`];

                const child = spawn(cmd, args, {
                    cwd: workspacePath,
                    shell: true,
                });

                child.stdout.on('data', (data) => {
                    const str = data.toString();

                    // Convertir la cadena a un objeto JSON
                    const json = JSON.parse(str);

                    panel.webview.html = getWebviewContent(
                        panel,
                        scriptUri,
                        json
                    );

                    console.log(`stdout: ${data}`);
                });

                child.stderr.on('data', (data) => {
                    // Convertir el buffer a una cadena
                    console.log(`stderr: ${data}`);

                    // console.error(`stderr: ${data}`);
                });

                child.on('close', (code) => {
                    console.log(`child process exited with code ${code}`);
                });
            } else {
                vscode.window.showErrorMessage('No workspace opened!');
            }
        }
    );

    context.subscriptions.push(disposable);
}

exports.activate = activate;

function getWebviewContent(panel, scriptUri, json) {
    let tests = json.testResults;

    const testsItems = tests
        .map((test, index) => {
            return `
            <div class="test-item ${test.status}">
            ${test.status == 'failed' ? '❌' : '✅'}
            ${test.name}
            </div>
    
            <div>
              <ul>
                ${(() => {
                    let status = json.testResults[index].status;
                    let results = json.testResults[index].assertionResults;
                    return results
                        .map((result) => {
                            let message = result.failureMessages
                                .join('\n\n')
                                .replace(/\x1b\[[0-9;]*m/g, '');
                            // at C:\sysgroup\angular\urldemo\src\app\home\home.component.spec.ts:49:26
                            const regex = /at\s+(.+?):(\d+)/;
                            const match = regex.exec(message);

                            if (match) {
                                let link = match[0].replace('at ', '');

                                let html = `<a href="#"  onclick="openFile('${encodeURI(
                                    link
                                )}')" >${link}</a>`;

                                message = message.replace(link, html);
                            }

                            return `<li class="closed ${result.status}">
                        <p class="open"> <span class="arrow"> < </span>   <span class="${
                            result.status
                        }">${result.status == 'failed' ? '❌' : '✅'}</span>
                            ${result.fullName}</p>
                        <div class="content">
                            <pre>${message}</pre>
                        </div>
                    </li>
            `;
                        })
                        .join('');
                })()}
              </ul>
          </div>
    `;
        })
        .join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <style>
        
        body {
            background: #1b1b1b;
            color: #ccc;
            font-family: monospace;
        }

        .test-item  {
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
        }
    
        li {
            border: 1px solid #ccc;
            margin: 4px;
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
    
        .closed  .arrow {
            transform: rotate(-90deg);
        }
    
    
        li.passed .open {
            background: #0c5f57;
        }
    
        li.failed  .open {
            background: #940e0e;
        }
    </style>

</head>
    <body>

    <h1>Jest Reporter</h1>

    <div>
        <div>Test Suites: ${json.numPassedTestSuites} passed, ${json.numTotalTestSuites} total</div>
        <div>Tests:       ${json.numPassedTests} passed, ${json.numTotalTests} total</div>
        <br>
        <div>Test Suites: ${json.numFailedTestSuites} failed, ${json.numTotalTestSuites} total</div>
        <div>Tests:       ${json.numFailedTests} failed, ${json.numTotalTests} total</div>
        <br>
        <div>Snapshots:   ${json.snapshot.total} total</div>
        <div>Time:        7.248 s</div>
    </div>

      <div>
        ${testsItems}
      </div>
  

    <script>

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
const vscode = acquireVsCodeApi();

function openFile(link) {
    link = decodeURI(link);
    let aux = link.split(':');

    let path = aux[0] + ':' + aux[1];
    let line = aux[2];

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

        <style>
        
        body {
            background: #1b1b1b;
            color: #ccc;
            font-family: monospace;
        }
        
        .arrow {
            transform: rotate(90deg);
            display: inline-block;
            font-family: monospace;
            font-weight: bold;
            font-size: 20px;
        }
        
        ul {
            list-style: none;
            padding: 0;
        }
    
        p.open {
            display: flex;
            justify-content: flex-start;
            gap: 16px;
            align-items: center;
            list-style: none;
            padding: 8px 16px;
            margin: 0;
            cursor: pointer;
        }
    
        li {
            border: 1px solid #ccc;
            margin: 8px;
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
    
        .closed  .arrow {
            transform: rotate(-90deg);
        }
    
    
        li.passed .open {
            background: #0c5f57;
        }
    
        li.failed  .open {
            background: #940e0e;
        }
    </style>

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
