import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { EWOULDBLOCK, defaultCipherList } from 'constants';
import { Range } from 'vscode';
import { start } from 'repl';
import { Z_NO_COMPRESSION } from 'zlib';
import { ChildProcess, spawn, exec, spawnSync, execSync } from 'child_process'
import * as moment from 'moment'

export namespace Import
{
    export class Configuration
    {
        DocumentDirectory: string = '';
        ImagesDirectory: string;
        ImageFilename: string;

        selectionRole: SelectionRole = SelectionRole.Filename;
        encoding: FilenameEncoding = FilenameEncoding.URIEncoding;
        mode: SelectionMode = SelectionMode.Insert;
    }

    enum SelectionRole
    {
        Filename,
        AltText,
        None,
    }

    enum SelectionMode 
    {
        Insert,
        Replace,
    }

    enum FilenameEncoding
    {
        None,
        URIEncoding,
    }

    enum SelectionContext
    {
        Inline,
        Block,
        Other
    };


    export class Image
    {
        static saveImageFromClipboard(filename: string): boolean
        {
            const script = 'C:\\Users\\seed\\Documents\\asciidoctor-vscode\\res\\pc.ps1';

            let child = spawn("powershell.exe",
                [`${script}`, `'${filename}'`],
                {
                    cwd: process.cwd(),
                    env: process.env,
                });

            child.stdout.on("data", function (data)
            {
                console.log("Powershell Data: " + data);
            });
            child.stderr.on("data", function (data)
            {
                console.log("Powershell Errors: " + data);
            });
            child.on("exit", function ()
            {
                console.log("Powershell Script finished");
            });
            child.stdin.end();

            return 0 == 0;
        }

        static ImportFromClipboard(config: Configuration)
        {
            config = config || new Configuration();

            const editor = vscode.window.activeTextEditor;

            let filename = moment().format("d-M-YYYY-HH-mm-ss-A.jpg").toString() //todo: default filename
            let alttext = ''; //todo:...
            let directory = this.get_current_imagesdir();

            // confirm directory is local--asciidoctor allows external URIs.
            let uri = vscode.Uri.parse(directory);
            if (uri.authority) return;


            const selectedText = editor.document.getText(editor.selection);
            if (!editor.selection.isEmpty)
            {
                switch (config.selectionRole)
                {
                    case SelectionRole.AltText:
                        alttext = selectedText;
                        break;
                    case SelectionRole.Filename:
                        filename = selectedText;
                        break;
                }
            }

            switch (config.encoding)
            {
                case FilenameEncoding.URIEncoding:
                    filename = encodeURIComponent(filename);
                    break;
            }

            if (!this.saveImageFromClipboard(`C:\\Users\\seed\\Documents\\jacksoncougar.github.io\\images\\${filename}`))
            return;

            const affectedLines = new vscode.Range(
                editor.selection.start.line,
                0,
                editor.selection.end.line + 1,
                0);

            const startOffset = editor.document.offsetAt(new vscode.Position(editor.selection.anchor.line, 0));
            const activeOffset = editor.document.offsetAt(editor.selection.active);
            const index = activeOffset - startOffset;

            const affectedText = editor.document.getText(affectedLines);

            let result = affectedText;

            const prediction = 'image::...[...]';

            switch (config.mode)
            {
                case SelectionMode.Insert:
                    result = affectedText.slice(0, index)
                        + prediction
                        + affectedText.slice(index);
                    break;
                case SelectionMode.Replace:
                    result = affectedText.replace(
                        selectedText,
                        prediction);
                    break;
                default: return;
            }

            const selected_text_is_block = /^[\t\f]*?image(?:::|::).+\[.*?\]\s*$/gmi;

            const is_inline = !selected_text_is_block.test(result);

            const macro = `image${is_inline ? ':' : '::'}${filename}[${alttext}]`

            editor.edit(edit =>
            {
                switch (config.mode)
                {
                    case SelectionMode.Insert:
                        edit.insert(editor.selection.active, macro);
                        break;
                    case SelectionMode.Replace:
                        edit.replace(editor.selection, macro)
                        break;
                }
            }
            );

        }


        /**
         * Reads the current `:imagesdir:` [attribute](https://asciidoctor.org/docs/user-manual/#setting-the-location-of-images) from the document.
         * 
         * **Caution**: Only reads from the _active_ document (_not_ `included` documents).
         * 
         * Reads the _nearest_ `:imagesdir:` attribute that appears _before_ the current selection 
         * or cursor location
         */
        static get_current_imagesdir()
        {
            const text = vscode.window.activeTextEditor.document.getText();

            const imagesdir = /^[\t\f]*?:imagesdir:\s+(.+?)\s+$/gmi
            let matches = imagesdir.exec(text);

            const index = vscode.window.activeTextEditor.selection.start;
            const cursor_index = vscode.window.activeTextEditor.document.offsetAt(index);

            let dir = "";
            while (matches && matches.index < cursor_index)
            {
                dir = matches[1] || "";
                matches = imagesdir.exec(text);
            }

            return dir;
        }

        /**
         * Checks if the given editor is a valid condidate _file_ for pasting images into.
         * @param editor vscode editor to check.
         */
        public static is_candidate_file(document: vscode.TextDocument): boolean
        {
            return document.uri.scheme === 'file';
        }

        /**
         * Checks if the given selected text is a valid _filename_ for an image.
         * @param selection Selected text to check.
         */
        public static is_candidate_selection(selection: string): boolean
        {
            return encodeURIComponent(selection) === selection;
        }

        /**
         * Checks if the current selection is an `inline` element of the document.
         */
        public static isInline
            (
            document: vscode.TextDocument,
            selection: vscode.Selection
            ): boolean
        {
            const line = document.lineAt(selection.start).text;
            const selected_text = document.getText(selection);
            const selected_text_is_block = new RegExp(`^${selected_text}\\w*$`);

            return selection.isSingleLine && !selected_text_is_block.test(line);
        }

        /**
         * Determines the context of the selection in the document.
         */
        public static getSelectionContext
            (
            document: vscode.TextDocument,
            selection: vscode.Selection
            ): SelectionContext
        {
            const line = document.lineAt(selection.start).text;
            const selected_text = document.getText(selection);
            const selected_text_is_block = new RegExp(`^${selected_text}\\w*$`);

            if (!selection.isSingleLine)
            {
                return SelectionContext.Other;
            }
            else if (selected_text_is_block)
            {
                return SelectionContext.Block;
            }
            else
            {
                return SelectionContext.Inline;
            }
        }

        static validate(
            required: {
                editor: vscode.TextEditor,
                selection: string
            }): boolean
        {
            if (!this.is_candidate_file(required.editor.document))
            {
                return false;
            }

            return true;
        }

        static isValidFilename(selection: string): { result: boolean, value?: string }
        {
            if (!this.is_candidate_selection(selection))
            {
                return { result: false, value: encodeURIComponent(selection) };
            }

            return { result: true, value: selection };
        }
    }



    function encodeFilename(config: Configuration, filename: string)
    {
        switch (config.encoding)
        {
            case FilenameEncoding.None:
                break;
            case FilenameEncoding.URIEncoding:
                filename = encodeURIComponent(filename);
                break;
            default: return filename;
        }
    }
};