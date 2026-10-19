import type { IndexHtmlTransformResult, Plugin } from 'vite';

const BUILD_TIME_META_NAME = 'asap-build-time';

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildBuildTimeMeta(buildTime: string): string {
  return `<meta name="${BUILD_TIME_META_NAME}" content="${escapeHtmlAttribute(buildTime)}">`;
}

function injectBuildTimeMeta(html: string, buildTime: string): string {
  const metaTag = buildBuildTimeMeta(buildTime);
  const existingMetaPattern = /<meta\b(?=[^>]*\bname=(["'])asap-build-time\1)[^>]*>/i;

  if (existingMetaPattern.test(html)) {
    return html.replace(existingMetaPattern, metaTag);
  }

  const headOpenPattern = /<head\b[^>]*>/i;
  const headOpenMatch = html.match(headOpenPattern);
  if (headOpenMatch) {
    return html.replace(headOpenPattern, `${headOpenMatch[0]}\n    ${metaTag}`);
  }

  const headClosePattern = /<\/head>/i;
  if (headClosePattern.test(html)) {
    return html.replace(headClosePattern, `    ${metaTag}\n  </head>`);
  }

  return `${metaTag}\n${html}`;
}

export function injectBuildTimePlugin(): Plugin {
  let buildTime = '';

  return {
    name: 'inject-build-time',
    apply: 'build',

    buildStart() {
      buildTime = new Date().toISOString();
    },

    transformIndexHtml(html): IndexHtmlTransformResult {
      if (!buildTime) {
        buildTime = new Date().toISOString();
      }

      return injectBuildTimeMeta(html, buildTime);
    },
  };
}
