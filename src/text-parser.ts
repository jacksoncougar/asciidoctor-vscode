import * as vscode from 'vscode';
import * as path from "path";
import * as Asciidoctor from "asciidoctor.js";
import { spawn } from "child_process";
import { isNullOrUndefined } from 'util';
import * as npm_which from "npm-which";

const fileUrl = require('file-url');
const Viz = require("viz.js");
var which = npm_which(__dirname) // __dirname often good enough

let previousHtml = null;
let use_asciidoctor_js = vscode.workspace.getConfiguration('AsciiDoc').get('use_asciidoctor_js');
const asciidoctor = Asciidoctor();


asciidoctor.Extensions.register(function () {
    this.block(function () {
        const self = this;
        self.named('graphviz');
        self.onContext('literal');
        self.process(function (parent, reader, attrs) {
            var svg = Viz(reader.getString());
            return self.createBlock(parent, 'pass', svg);
        });
    });
});

asciidoctor.Extensions.register(function () {
    this.block(function () {
        const self = this;
        self.named('mermaid');
        self.onContext('literal');
        self.process(function (parent, reader, attrs) {
            const txt = reader.getString();
            const html = `<div class="mermaid">${txt}</div>`
            return self.createBlock(parent, 'pass', html);
        });
    });
});

export class AsciiDocParser {
    public html: string = '';
    public document = null;

    constructor(private readonly filename: string, private readonly text: string) {
    }

    public getAttribute(name: string) {
        return isNullOrUndefined(this.document) ? null : this.document.getAttribute(name);
    }

    public async getMediaDir() {
        const match = this.text.match(new RegExp("^\\s*:mediadir:"));
        return match;
    }

    private async convert_using_javascript() {
        return new Promise<string>(resolve => {
            const contains_stylesheet = !isNullOrUndefined(this.text.match(new RegExp("^\\s*:stylesheet:", "img")));
            const documentPath = path.dirname(this.filename);
            const ext_path = vscode.extensions.getExtension('joaompinto.asciidoctor-vscode').extensionPath;
            const stylesdir = path.join(ext_path, 'assets')
            var attributes = {};
            if (contains_stylesheet)
                attributes = { 'copycss': true }
            else
                attributes = { 'copycss': true, 'stylesdir': stylesdir, 'stylesheet': 'asciidoctor.css' }
            const options = {
                safe: 'unsafe',
                doctype: 'inline',
                attributes: attributes,
                header_footer: true,
                to_file: false,
                base_dir: documentPath,
                sourcemap: true,
            }
            let ascii_doc = asciidoctor.load(this.text, options);
            this.document = ascii_doc;
            const blocksWithLineNumber = ascii_doc.findBy(function (b) { return typeof b.getLineNumber() !== 'undefined'; });
            blocksWithLineNumber.forEach(function (block, key, myArray) {
                block.addRole("data-line-" + block.getLineNumber());
            })
            let resultHTML = ascii_doc.convert(options);
            let result = this.fixLinks(resultHTML);
            resolve(result);
        })
    }

    private async convert_using_application() {
        let documentPath = path.dirname(this.filename);
        this.document = null;

        return new Promise<string>(resolve => {
            let asciidoctor_command = vscode.workspace.getConfiguration('AsciiDoc').get('asciidoctor_command', 'asciidoctor');
            var options = { shell: true, cwd: path.dirname(this.filename) }
            var asciidoctor = spawn(asciidoctor_command, ['-q', '-o-', '-', '-B', '\'' + documentPath + '\''], options);
            asciidoctor.stderr.on('data', (data) => {
                let errorMessage = data.toString();
                console.error(errorMessage);
                errorMessage += errorMessage.replace("\n", '<br><br>');
                errorMessage += "<br><br>"
                errorMessage += "<b>If the asciidoctor binary is not in your PATH, you can set the full path.<br>"
                errorMessage += "Go to `File -> Preferences -> User settings` and adjust the AsciiDoc.asciidoctor_command</b>"
                resolve(errorMessage);
            })
            var result_data = ''
            /* with large outputs we can receive multiple calls */
            asciidoctor.stdout.on('data', (data) => {
                result_data += data.toString();
            });
            asciidoctor.on('close', (code) => {
                var result = this.fixLinks(result_data);
                resolve(result);
            })
            asciidoctor.stdin.write(this.text);
            asciidoctor.stdin.end();
        });
    }

    private fixLinks(html: string): string {
        let result = html.replace(
            new RegExp("((?:src|href)=[\'\"])(?!(?:http:|https:|ftp:|#))(.*?)([\'\"])", "gmi"),
            (subString: string, p1: string, p2: string, p3: string): string => {
                return [
                    p1,
                    fileUrl(path.join(
                        path.dirname(this.filename),
                        p2
                    )),
                    p3
                ].join("");
            }
        );
        return result;
    }

    public async parseText(): Promise<string> {
        if (use_asciidoctor_js)
            return this.convert_using_javascript()
        else
            return this.convert_using_application()
    }

}


