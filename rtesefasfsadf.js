const spawn = require('cross-spawn');
const vscode = require('vscode');
const path = require('path');

function activate(context) {
    let disposable = vscode.commands.registerCommand(
        'extension.miComando',
        function () {
            const terminal = vscode.window.createTerminal();

            let filePath = vscode.window.activeTextEditor.document.uri.fsPath;
            let workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
            let relativePath = path.relative(workspacePath, filePath);

            workspacePath = workspacePath.replace(/\\/gim, '/');
            filePath = filePath.replace(/\\/gim, '/');
            relativePath = relativePath.replace(/\\/gim, '/');

            const cmd = `./node_modules/.bin/jest  ${relativePath} --json`;

            const panel = vscode.window.createWebviewPanel(
                'webview',
                'Webview Example',
                vscode.ViewColumn.One,
                {
                    enableScripts: true, // Permitir scripts en la vista web
                }
            );

            const scriptPathOnDisk = vscode.Uri.file(
                path.join(context.extensionPath, 'public','js', 'script.js')
            );

            const scriptUri = panel.webview.asWebviewUri(scriptPathOnDisk);

            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                const workspacePath = workspaceFolders[0].uri.fsPath;
                const cmd = `jest`;
                const args = [`${relativePath}`, `--json`];

                const child = spawn(cmd, args, {
                    cwd: workspacePath,
                    shell: true,
                });

                child.stdout.on('data', (data) => {
                    const str = data.toString();

                    // Convertir la cadena a un objeto JSON
                    const json = JSON.parse(str);


                    panel.webview.html = getWebviewContent(scriptUri, json);

                    console.log(`stdout: ${data}`);
                });

                child.stderr.on('data', (data) => {
                    // Convertir el buffer a una cadena

                    console.error(`stderr: ${data}`);
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

function getWebviewContent(scriptUri, json) {
    // <script src="${scriptUri.path}"></script>

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Webview Example</title>
        </head>
        <body>
           
        </body>
        </html>
    `;
}
