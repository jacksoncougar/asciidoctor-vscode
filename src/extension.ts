/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CommandManager } from './commandManager';
import * as commands from './commands/index';
import LinkProvider from './features/documentLinkProvider';
import MDDocumentSymbolProvider from './features/documentSymbolProvider';
import AsciidocFoldingProvider from './features/foldingProvider';
import { AsciidocContentProvider } from './features/previewContentProvider';
import { AsciidocPreviewManager } from './features/previewManager';
import AsciidocWorkspaceSymbolProvider from './features/workspaceSymbolProvider';
import { Logger } from './logger';
import { AsciidocEngine } from './asciidocEngine';
import { getAsciidocExtensionContributions } from './asciidocExtensions';
import { ExtensionContentSecurityPolicyArbiter, PreviewSecuritySelector } from './security';
import { githubSlugifier } from './slugify';


export function activate(context: vscode.ExtensionContext) {

	const contributions = getAsciidocExtensionContributions(context);

	const cspArbiter = new ExtensionContentSecurityPolicyArbiter(context.globalState, context.workspaceState);
	const engine = new AsciidocEngine(contributions, githubSlugifier);
	const logger = new Logger();

	const selector: vscode.DocumentSelector = [
		{ language: 'asciidoc', scheme: 'file' },
		{ language: 'asciidoc', scheme: 'untitled' }
	];

	const contentProvider = new AsciidocContentProvider(engine, context, cspArbiter, contributions, logger);
	const symbolProvider = new MDDocumentSymbolProvider(engine);
    const previewManager = new AsciidocPreviewManager(contentProvider, logger, contributions);
	context.subscriptions.push(previewManager);

	context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(selector, symbolProvider));
	context.subscriptions.push(vscode.languages.registerDocumentLinkProvider(selector, new LinkProvider()));
	context.subscriptions.push(vscode.languages.registerFoldingRangeProvider(selector, new AsciidocFoldingProvider(engine)));
	context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(new AsciidocWorkspaceSymbolProvider(symbolProvider)));

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
}
