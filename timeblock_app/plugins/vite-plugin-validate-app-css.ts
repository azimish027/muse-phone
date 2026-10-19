import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import type { Plugin } from 'vite';

const MIN_APP_CSS_CODE_LINES = 4;
const APP_CSS_IMPORT_PATH = './App.css';

function stripCssComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, (comment) => {
    const newlineCount = comment.match(/\r\n|\r|\n/g)?.length ?? 0;
    return '\n'.repeat(newlineCount);
  });
}

function countCssCodeLines(code: string): number {
  return stripCssComments(code)
    .split(/\r\n|\r|\n/)
    .filter((line) => line.trim().length > 0)
    .length;
}

function hasAppCssImport(code: string, filePath: string): boolean {
  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  return sourceFile.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      !statement.importClause &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === APP_CSS_IMPORT_PATH,
  );
}

export function validateAppCssPlugin(): Plugin {
  let appCssPath = '';
  let appTsxPath = '';
  let skipCheck = false;

  return {
    name: 'validate-app-css',
    enforce: 'pre',
    apply: 'build',

    configResolved(config) {
      appCssPath = path.resolve(config.root, 'src/App.css');
      appTsxPath = path.resolve(config.root, 'src/App.tsx');
      skipCheck = config.env.VITE_ASAP_SKIP_APP_CSS_CHECK === '1';
    },

    async buildStart() {
      if (!appCssPath) return;
      if (skipCheck) return;

      let code = '';
      try {
        code = await fs.readFile(appCssPath, 'utf8');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.error({
          message:
            `[validate-app-css] 构建失败: 缺少 src/App.css\n` +
            `文件: ${appCssPath}\n\n` +
            `错误: ${message}\n\n` +
            '你是不是忘记给应用写样式了？请创建 src/App.css 并补充必要的布局、颜色、间距、字体或响应式样式。',
          loc: {
            file: appCssPath,
            line: 1,
            column: 1,
          },
        });
      }

      const codeLineCount = countCssCodeLines(code);
      if (codeLineCount < MIN_APP_CSS_CODE_LINES) {
        this.error({
          message:
            `[validate-app-css] 构建失败: src/App.css 的样式代码过少\n` +
            `文件: ${appCssPath}\n` +
            `有效代码行: ${codeLineCount}/${MIN_APP_CSS_CODE_LINES}\n\n` +
            '你是不是忘记给应用写样式了？请为应用补充必要的布局、颜色、间距、字体或响应式样式。',
          loc: {
            file: appCssPath,
            line: 1,
            column: 1,
          },
        });
      }

      let appCode = '';
      try {
        appCode = await fs.readFile(appTsxPath, 'utf8');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.error({
          message:
            `[validate-app-css] 构建失败: 无法读取 src/App.tsx\n` +
            `文件: ${appTsxPath}\n\n` +
            `错误: ${message}\n\n` +
            `src/App.css 已通过有效性检查，请确保 src/App.tsx 存在并添加:\nimport '${APP_CSS_IMPORT_PATH}';`,
          loc: {
            file: appTsxPath,
            line: 1,
            column: 1,
          },
        });
      }

      if (hasAppCssImport(appCode, appTsxPath)) return;

      this.error({
        message:
          `[validate-app-css] 构建失败: src/App.css 已通过有效性检查，但 src/App.tsx 未导入该样式文件\n` +
          `文件: ${appTsxPath}\n\n` +
          `请在 src/App.tsx 中添加:\nimport '${APP_CSS_IMPORT_PATH}';`,
        loc: {
          file: appTsxPath,
          line: 1,
          column: 1,
        },
      });
    },
  };
}
