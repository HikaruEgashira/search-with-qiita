import * as vscode from 'vscode';

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import {window, workspace, commands, ExtensionContext, EventEmitter,TextDocumentContentProvider, Uri, ViewColumn} from 'vscode';


// this method is called when your extension is activated. activation is
// controlled by the activation events defined in package.json
export function activate(ctx: ExtensionContext) {

    let provider = new GoogleSearchProvider();
	let registration = workspace.registerTextDocumentContentProvider(GoogleSearchProvider.SCHEME, provider);

    // The command has been defined in the package.json file
    // The commandId parameter must match the command field in package.json
    // onCommandの部分search-with-qiita
    var search_cmd = commands.registerCommand('search-with-qiita.search', () => {
        GoogleSearchController.extractPhraseAndSearch();
    });

    // add to a list of disposables which are disposed when this extension
    // is deactivated again.
    ctx.subscriptions.push(search_cmd);
    ctx.subscriptions.push(registration);
    ctx.subscriptions.push(provider);
}

export class GoogleSearchController {

    private static getConfig() {
        return workspace.getConfiguration("google-search-ext");
    }

    private static defaultDocs : object = {
        "py": "python",
        "js": "javascript",
        "ts": "typescript",
        "kt": "kotlin",
        "rb": "ruby",
        "htm": "html",
        "cpp": "c++",
        "md": "markdown"
    };

    public static getLang(ext: string, customDocs?: object): String {

        let docs : any = this.defaultDocs;
        if (customDocs) {
            Object.assign(docs, customDocs);
        }

        if (ext in docs) {
            return docs[ext];
        } else {
            return ext;
        }
    }

    private static showHTMLWindow(phrase: string) {
        //configを取得する
        const config = this.getConfig();
        const customDocs = config.get<object>("customDocs");
        //ここでlang取得(=ext)
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active text editor found!');
            return;
        }

        let extIndex: number = editor.document.fileName.lastIndexOf('.');
        let lang: string = extIndex >= 0 ? editor.document.fileName.substring(extIndex + 1) : '';

        const uriphrase = `${encodeURI(phrase)}+tag%3A${this.getLang(lang, customDocs)}`;
        const query = [
                `q=${uriphrase}`,
                `oq=${uriphrase}`,
                'sourceid=chrome',
                'ie=UTF-8',
                //ストックの多い順にしている
                'sort=stock'
            ]
            .join("&");

        const previewUri = Uri.parse(`${GoogleSearchProvider.SCHEME}://google/search.html?${query}`);

        return commands.executeCommand(
            "vscode.previewHtml",
            previewUri,
            ViewColumn.Two
        ).then((s) => {
        }, window.showErrorMessage);

    }

    private static getSearchPhrase(): string {
        const editor = window.activeTextEditor;
       if (!editor)
           return null;
        const text = editor.document.getText();
       if (!text)
           return null;
        let selStart, selEnd;

        if (editor.selection.isEmpty) {
            selStart = editor.document.offsetAt(editor.selection.anchor);
            // the next or previous character at the caret must be a word character
            let i = selStart - 1;
            if (!((i < text.length - 1 && /\w/.test(text[i + 1])) || (i > 0 && /\w/.test(text[i]))))
                return null;
            for (; i >= 0; i--) {
                if (!/\w/.test(text[i])) break;
            }
            if (i < 0) i = 0;
            for (; i < text.length; i++) {
                if (/\w/.test(text[i])) break;
            }
            const wordMatch = text.slice(i).match(/^\w+/);
            selStart = i;
            selEnd = selStart + (wordMatch ? wordMatch[0].length : 0);
        } else {
            selStart = editor.document.offsetAt(editor.selection.start);
            selEnd = editor.document.offsetAt(editor.selection.end);
        }

        let phrase = text.slice(selStart, selEnd).trim();
        phrase = phrase.replace(/\s\s+/g,' ');
        // limit the maximum searchable length to 100 characters
        phrase = phrase.slice(0, 100).trim();
        return phrase;
    }

    public static async extractPhraseAndSearch() {
        let phrase = GoogleSearchController.getSearchPhrase();
        if (phrase == null)
        {
            phrase = await window.showInputBox({ prompt: "検索" });
            if (phrase === undefined)
                return;
        }
        return this.showHTMLWindow(phrase);
    }

    public dispose() {
    }
}

export default class GoogleSearchProvider implements TextDocumentContentProvider {

    public static readonly SCHEME = 'search-preview';
	private _onDidChange = new EventEmitter<Uri>();

	constructor() {
	}

	dispose() {
		this._onDidChange.dispose();
	}

	// Expose an event to signal changes of _virtual_ documents
	// to the editor
	get onDidChange() {
		return this._onDidChange.event;
	}

	// Provider method that takes an uri of the `references`-scheme and
	// resolves its content by (1) running the reference search command
	// and (2) formatting the results
	provideTextDocumentContent(uri: Uri): string | Thenable<string> {

        let url = 'https://qiita.com/';
        let urlorigin = url;

        if (uri.query)
            url = `${urlorigin}/search?${uri.query}`;
            // vscode.window.showWarningMessage(`url is ${url}`);
        let s = `<!DOCTYPE html>
<html>

<!--
Yikes!
If you're seeing this, VS Code has chosen to render this content as plain-text
instead of HTML. As interesting as this file is, you'll need to close this and launch a
new search to get any results.
-->

<script type="text/javascript">
(function() {
    function logerr(err) {
        console.log(err);
        var imgb64 = 'iVBORw0KGgoAAAANSUhEUgAAACsAAAArCAYAAADhXXHAAAAABHNCSVQICAgIfAhkiAAAAPpJREFUWIXtl00OhCAMRmHiDeGY9IzOqolBmwr9mSnhrVwg1Ocn1JyMKaWckvsBIOP1R16OH5kfMofUaA8AZDezrbXUWhPNESoGh9dCtVbxHKHM7mKt2MVa4bYbUFyPU45QZv/2uH0yHtMsmhjJ0BNvjc6sE8qsym6g3Q5ShDJ7yyzCZcqiuebGhDJLZpbaHbSM4rwj84UyS2bWmuX32V2sFbfceGV3JrPuzbekUSJvtDIsKTZ2Znu0TywJa5lFZg1rGEXWNItQhqkuStPswb1ezcVSkn2wYrPUw2j9LV8Jldnp41Y7Hm9gf2uQXxTXY55ZbtwIITKLD/4FTcJrVgXsz78AAAAASUVORK5CYII=';
        var oh = '<img src="data:image/png;base64,'+imgb64+'">';
        document.body.innerHTML = ['<div style="padding:1em;text-align:center;">',oh,'<div style="color:#333;padding-top:1em;">',err,'</div>','</div>'].join('');
        document.body.style.background='#F7F7F7';
    }

    function replacePage(content) {
        try {
            var body = content
                .replace(/class="btn btn-default"/g,'')
                .replace(/searchResultContainer_sortButton/g,'')
                .replace(/dropdown/g,'')
                .replace(/fa-check/g,'')
                .replace(/新着順/g,'')
                .replace(/関連順/g,'')
                .replace(/searchResultContainer_sortButtonContaine"/g,'')
                .replace(/fa-sort-amount-desc/g,'')
                .replace(/dropdown-menu/g,'')
                .replace(/ストック数順/g,'')
                .replace(/<img\\b[^>]*>/g,'')
                .replace(/<button\\b/g,'<button style="display:none"')
                .replace(/<input\\b/g,'<input style="display:none" disabled="disabled"')
                .replace(/<form\\b/g,'<form style="display:none"')
                .replace(/class="action-menu/g,'style="display:none" class="action-menu')
                .replace(/href="\\//g,'href="${urlorigin}/')
                .replace(/href='\\//g,"href='${urlorigin}/")
            document.body.innerHTML = body;
            document.body.style.background='#fff';
            document.body.style.color='#333';
        } catch(err) {
            logerr(err);
        }
    }

    function showHTTPError(code) {
        logerr('HTTP Error: '+code);
    }

    function makeRequest(url) {
        var httpRequest = new XMLHttpRequest();
        if (!httpRequest) return logerr('new XMLHttpRequest() failed');
        httpRequest.onerror = function(e) {
            logerr("Request failed. There's a problem with your network connectivity or the site cannot be contacted.");
        }
        httpRequest.onreadystatechange = function() {
            if (this.readyState === XMLHttpRequest.DONE) {
                if (this.status === 200)
                    replacePage(this.responseText);
                else
                    showHTTPError(this.status);
            }
        }.bind(httpRequest);
        httpRequest.open('GET', url);
        httpRequest.send();
    }
    makeRequest('${url}');
})();
</script>
<body style="background:#fff;">
</body>
</html>`;
        return s;
	}
}