const path = require('path');
const ts = require('typescript');

const blockedQuickJsBuiltinModules = new Set(['std', 'os']);

function formatSourcePosition(sourceFile, position) {
  const location = sourceFile.getLineAndCharacterOfPosition(position);
  return `${location.line + 1}:${location.character + 1}`;
}

function isGlobalConsoleObject(node) {
  if (ts.isIdentifier(node) && node.text === 'console') {
    return true;
  }
  return (
    ts.isPropertyAccessExpression(node) &&
    node.name.text === 'console' &&
    ts.isIdentifier(node.expression) &&
    (node.expression.text === 'globalThis' || node.expression.text === 'window')
  );
}

function isConsolePropertyAccess(node) {
  return ts.isPropertyAccessExpression(node) && isGlobalConsoleObject(node.expression);
}

function isConsoleElementAccess(node) {
  return ts.isElementAccessExpression(node) && isGlobalConsoleObject(node.expression);
}

function getConsoleAccessName(node) {
  if (ts.isPropertyAccessExpression(node)) {
    return node.name.text || '*';
  }
  if (ts.isElementAccessExpression(node)) {
    const argument = node.argumentExpression;
    if (ts.isStringLiteral(argument) || ts.isNumericLiteral(argument)) {
      return argument.text || '*';
    }
  }
  return '*';
}

function isBlockedQuickJsBuiltinModule(moduleName) {
  return blockedQuickJsBuiltinModules.has(moduleName);
}

function getStringLiteralText(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return null;
}

function getRequireCallModuleName(node) {
  if (
    !ts.isCallExpression(node) ||
    !ts.isIdentifier(node.expression) ||
    node.expression.text !== 'require' ||
    node.arguments.length !== 1
  ) {
    return null;
  }
  return getStringLiteralText(node.arguments[0]);
}

function getDynamicImportModuleName(node) {
  if (!ts.isCallExpression(node) || node.expression.kind !== ts.SyntaxKind.ImportKeyword || node.arguments.length !== 1) {
    return null;
  }
  return getStringLiteralText(node.arguments[0]);
}

function formatBlockedModuleFinding(sourceFile, relativePath, node, moduleName) {
  return (
    `${relativePath}:${formatSourcePosition(sourceFile, node.getStart(sourceFile))} - ` +
    `QuickJS built-in module "${moduleName}" is not allowed in service controller. ` +
    'Use @server SDK capabilities instead.'
  );
}

function collectConsoleUsageFindings(sourceFile, options = {}) {
  const relativePath = options.relativePath || path.basename(sourceFile.fileName);
  const findings = [];

  function visit(node) {
    if (isConsolePropertyAccess(node) || isConsoleElementAccess(node)) {
      const methodName = getConsoleAccessName(node);
      findings.push(
        `${relativePath}:${formatSourcePosition(sourceFile, node.getStart(sourceFile))} - ` +
          `console.${methodName} is not allowed in QuickJS service controller. ` +
          'stdout is reserved for the QuickJS runtime protocol; remove console.* logging.',
      );
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function collectBlockedQuickJsBuiltinModuleFindings(sourceFile, options = {}) {
  const relativePath = options.relativePath || path.basename(sourceFile.fileName);
  const findings = [];

  function checkModuleSpecifier(node, moduleSpecifier) {
    const moduleName = getStringLiteralText(moduleSpecifier);
    if (moduleName && isBlockedQuickJsBuiltinModule(moduleName)) {
      findings.push(formatBlockedModuleFinding(sourceFile, relativePath, node, moduleName));
    }
  }

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      (ts.isStringLiteral(node.moduleSpecifier) || ts.isNoSubstitutionTemplateLiteral(node.moduleSpecifier))
    ) {
      checkModuleSpecifier(node, node.moduleSpecifier);
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      checkModuleSpecifier(node, node.moduleReference.expression);
    } else {
      const requireModuleName = getRequireCallModuleName(node);
      if (requireModuleName && isBlockedQuickJsBuiltinModule(requireModuleName)) {
        findings.push(formatBlockedModuleFinding(sourceFile, relativePath, node, requireModuleName));
      }

      const dynamicImportModuleName = getDynamicImportModuleName(node);
      if (dynamicImportModuleName && isBlockedQuickJsBuiltinModule(dynamicImportModuleName)) {
        findings.push(formatBlockedModuleFinding(sourceFile, relativePath, node, dynamicImportModuleName));
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return findings;
}

function runControllerSourcePolicyCheck(options) {
  const controllerPath = options.controllerPath;
  const serviceRoot = options.serviceRoot || path.dirname(controllerPath);
  const sourceText = options.readFile(controllerPath);
  const sourceFile = ts.createSourceFile(controllerPath, sourceText, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
  const relativePath = path.relative(serviceRoot, controllerPath) || controllerPath;

  return [
    ...collectConsoleUsageFindings(sourceFile, { relativePath }),
    ...collectBlockedQuickJsBuiltinModuleFindings(sourceFile, { relativePath }),
  ];
}

module.exports = {
  collectBlockedQuickJsBuiltinModuleFindings,
  collectConsoleUsageFindings,
  runControllerSourcePolicyCheck,
};
