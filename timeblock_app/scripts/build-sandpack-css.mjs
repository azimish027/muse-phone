import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import autoprefixer from 'autoprefixer'
import fg from 'fast-glob'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'

const projectRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const inputPath = path.join(projectRoot, 'src/index.css')
const outputPath = path.join(projectRoot, 'src/index.sandpack.css')
const watchPatterns = [
  'index.html',
  'src/**/*.{js,jsx,ts,tsx,css}',
  'tailwind.config.*',
  'postcss.config.*',
]
const watchIgnorePatterns = ['src/index.sandpack.css', 'src/index.sandpack.css.*.tmp']

const args = new Set(process.argv.slice(2))
const shouldWatch = args.has('--watch')
const debounceMs = 180
const pollMs = 500

process.chdir(projectRoot)

async function buildSandpackCss() {
  const startedAt = Date.now()
  const input = await fs.readFile(inputPath, 'utf8')
  const result = await postcss([tailwindcss(), autoprefixer()]).process(input, {
    from: inputPath,
    to: outputPath,
    map: false,
  })

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  const tempPath = `${outputPath}.${process.pid}.tmp`
  await fs.writeFile(tempPath, result.css, 'utf8')
  await fs.rename(tempPath, outputPath)

  console.log(
    `[sandpack:css] wrote ${path.relative(projectRoot, outputPath)} (${result.css.length} bytes, ${Date.now() - startedAt}ms)`,
  )
}

async function runBuild({ failOnError }) {
  try {
    await buildSandpackCss()
    return true
  } catch (error) {
    console.error('[sandpack:css] build failed; keeping the previous CSS output')
    console.error(error)
    if (failOnError) {
      process.exitCode = 1
    }
    return false
  }
}

async function collectWatchState() {
  const entries = await fg(watchPatterns, {
    cwd: projectRoot,
    absolute: true,
    dot: false,
    ignore: watchIgnorePatterns,
    onlyFiles: true,
    unique: true,
  })
  const state = new Map()

  await Promise.all(
    entries.map(async (entry) => {
      try {
        const stat = await fs.stat(entry)
        state.set(entry, `${stat.mtimeMs}:${stat.size}`)
      } catch {
        state.set(entry, 'missing')
      }
    }),
  )

  return state
}

function hasWatchStateChanged(previous, next) {
  if (previous.size !== next.size) {
    return true
  }
  for (const [filePath, signature] of next) {
    if (previous.get(filePath) !== signature) {
      return true
    }
  }
  return false
}

async function watchSandpackCss() {
  await runBuild({ failOnError: false })
  let watchState = await collectWatchState()
  let timer = null
  let building = false
  let pending = false

  const scheduleBuild = () => {
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(async () => {
      timer = null
      if (building) {
        pending = true
        return
      }
      building = true
      await runBuild({ failOnError: false })
      building = false
      if (pending) {
        pending = false
        scheduleBuild()
      }
    }, debounceMs)
  }

  console.log(`[sandpack:css] watching ${watchPatterns.join(', ')}`)
  setInterval(async () => {
    try {
      const nextState = await collectWatchState()
      if (hasWatchStateChanged(watchState, nextState)) {
        watchState = nextState
        scheduleBuild()
      }
    } catch (error) {
      console.error('[sandpack:css] watch scan failed')
      console.error(error)
    }
  }, pollMs)
}

if (shouldWatch) {
  await watchSandpackCss()
} else {
  await runBuild({ failOnError: true })
}
