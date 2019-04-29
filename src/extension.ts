/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
<<<<<<< HEAD

var tmp = require('tmp');
var fs = require("fs");

import TextDocumentContentProvider from './TextDocumentContentProvider';
import registerDocumentSymbolProvider from './AsciiDocSymbolProvider';
import ExportAsPDF from './ExportAsPDF';

import * as path from "path";
import * as AsciiDoc from "asciidoctor.js";
import { Logger, Paster } from './image-paste';
import { Import } from './asciidoctor-image-paste';


let provider: TextDocumentContentProvider;

export function activate(context: vscode.ExtensionContext): void
{

    const previewUri = vscode.Uri.parse('asciidoc://authority/asciidoc');
    let document: vscode.TextDocument = null

    provider = new TextDocumentContentProvider(previewUri);
    vscode.workspace.registerTextDocumentContentProvider('asciidoc', provider);

    vscode.workspace.onDidSaveTextDocument(e =>
    {
        provider.update(previewUri);
    })

    vscode.workspace.onDidChangeTextDocument(e =>
    {
        if (isAsciiDocFile(e.document))
        {
            provider.needsRebuild = true
            if (e.contentChanges.length > 0)
            {
                var range = e.contentChanges[0].range
                var line = range.start.line
                provider.current_line = line;
            }
        }
    })

    vscode.window.onDidChangeTextEditorSelection(e =>
    {
        provider.current_line = e.selections[0].anchor.line;
        provider.needsRebuild = true;
    })


    vscode.window.onDidChangeActiveTextEditor(e =>
    {
        if (isAsciiDocFile(e.document))
        {
            provider.needsRebuild = true
            provider.update(previewUri)
        }
    })

    let displayColumn: vscode.ViewColumn;
    switch (vscode.window.activeTextEditor.viewColumn)
    {
        case vscode.ViewColumn.One:
            displayColumn = vscode.ViewColumn.Two;
            break;
        case vscode.ViewColumn.Two:
        case vscode.ViewColumn.Three:
            displayColumn = vscode.ViewColumn.Three;
            break;
    }

    const pasteImage = vscode.commands.registerCommand('adoc.pasteImage', () =>
    {
        try
        {
            Import.Image.ImportFromClipboard(null);
        } catch (e)
        {
            Logger.showErrorMessage(e)
        }
    });

    
    const boldText = vscode.commands.registerCommand('adoc.boldText', () =>
    {
        try
        {
            vscode.window.activeTextEditor.selection
        } catch (e)
        {
            Logger.showErrorMessage(e)
        }
    });

    const previewToSide = vscode.commands.registerCommand("adoc.previewToSide", () =>
    {
        vscode.commands
            .executeCommand('vscode.previewHtml', previewUri, displayColumn, 'asciidoc')
            .then(() => { }, vscode.window.showErrorMessage);
    })

    const preview = vscode.commands.registerCommand("adoc.preview", () =>
    {
        provider.needsRebuild = true
        provider.active_update(previewUri)
        vscode.commands
            .executeCommand('vscode.previewHtml', previewUri, vscode.window.activeTextEditor.viewColumn, 'asciidoc')
            .then(() => { }, vscode.window.showErrorMessage)
    })


    const symbolProvider = registerDocumentSymbolProvider();

    const ExportAsPDFDisposable = vscode.commands.registerCommand("adoc.ExportAsPDF", ExportAsPDF);

    context.subscriptions.push(
        pasteImage,
        previewToSide,
        preview,
        symbolProvider,
        ExportAsPDFDisposable
    );

}

// this method is called when your extension is deactivated
export function deactivate(): void
{
=======
import { CommandManager } from './commandManager';
import * as commands from './commands/index';
import LinkProvider from './features/documentLinkProvider';
import MDDocumentSymbolProvider from './features/documentSymbolProvider';
import MarkdownFoldingProvider from './features/foldingProvider';
import { MarkdownContentProvider } from './features/previewContentProvider';
import { MarkdownPreviewManager } from './features/previewManager';
import MarkdownWorkspaceSymbolProvider from './features/workspaceSymbolProvider';
import { Logger } from './logger';
import { MarkdownEngine } from './markdownEngine';
import { getMarkdownExtensionContributions } from './markdownExtensions';
import { ExtensionContentSecurityPolicyArbiter, PreviewSecuritySelector } from './security';
import { githubSlugifier } from './slugify';


export function activate(context: vscode.ExtensionContext) {

	const contributions = getMarkdownExtensionContributions(context);

	const cspArbiter = new ExtensionContentSecurityPolicyArbiter(context.globalState, context.workspaceState);
	const engine = new MarkdownEngine(contributions, githubSlugifier);
	const logger = new Logger();

	const selector: vscode.DocumentSelector = [
		{ language: 'asciidoc', scheme: 'file' },
		{ language: 'asciidoc', scheme: 'untitled' }
	];

	const contentProvider = new MarkdownContentProvider(engine, context, cspArbiter, contributions, logger);
	const symbolProvider = new MDDocumentSymbolProvider(engine);
    const previewManager = new MarkdownPreviewManager(contentProvider, logger, contributions);
	context.subscriptions.push(previewManager);

	context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(selector, symbolProvider));
	context.subscriptions.push(vscode.languages.registerDocumentLinkProvider(selector, new LinkProvider()));
	context.subscriptions.push(vscode.languages.registerFoldingRangeProvider(selector, new MarkdownFoldingProvider(engine)));
	context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(new MarkdownWorkspaceSymbolProvider(symbolProvider)));

	const previewSecuritySelector = new PreviewSecuritySelector(cspArbiter, previewManager);

	const commandManager = new CommandManager();
	context.subscriptions.push(commandManager);
	commandManager.register(new commands.ShowPreviewCommand(previewManager));
	commandManager.register(new commands.ShowPreviewToSideCommand(previewManager));
	commandManager.register(new commands.ShowLockedPreviewToSideCommand(previewManager));
	commandManager.register(new commands.ShowSourceCommand(previewManager));
	commandManager.register(new commands.RefreshPreviewCommand(previewManager));
	commandManager.register(new commands.MoveCursorToPositionCommand());
	commandManager.register(new commands.ShowPreviewSecuritySelectorCommand(previewSecuritySelector, previewManager));
    commandManager.register(new commands.OpenDocumentLinkCommand(engine));
    commandManager.register(new commands.ExportAsPDF(engine));
    commandManager.register(new commands.PasteImage());
	commandManager.register(new commands.ToggleLockCommand(previewManager));
    commandManager.register(new commands.ShowPreviewCommand(previewManager));

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(() => {
		logger.updateConfiguration();
		previewManager.updateConfiguration();
	}));
>>>>>>> upstream/master
}
