import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { strToU8, zipSync } from 'fflate'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..')
const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8')) as { version?: unknown }
const version = String(packageJson.version ?? '')

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid package version for release paths: ${version}`)
}

const offlineHtmlPath = join(repoRoot, 'dist-offline', 'index.html')
const releaseRoot = resolve(repoRoot, 'release')
const releaseDir = resolve(releaseRoot, `v${version}`)
const releaseRelative = relative(releaseRoot, releaseDir)
if (!releaseRelative || releaseRelative.startsWith('..') || isAbsolute(releaseRelative)) {
  throw new Error('Release output escaped the release directory.')
}

const htmlName = `reverse-archive-${version}.html`
const zipName = `reverse-archive-${version}-offline.zip`
const htmlAsset = join(releaseDir, htmlName)
const zipAsset = join(releaseDir, zipName)
const checksums = join(releaseDir, 'SHA256SUMS.txt')

const offlineHtml = await readFile(offlineHtmlPath)
const playerGuideTemplate = await readFile(join(repoRoot, 'docs', 'OFFLINE_PLAY.txt'), 'utf8')
const playerGuide = playerGuideTemplate.replaceAll('{{VERSION}}', version)
const notices = await readFile(join(repoRoot, 'docs', 'THIRD_PARTY_NOTICES.txt'), 'utf8')
const fixedTimestamp = new Date(2000, 0, 1, 0, 0, 0)

const zip = zipSync({
  'Reverse-Archive.html': [offlineHtml, { mtime: fixedTimestamp }],
  'README.txt': [strToU8(playerGuide), { mtime: fixedTimestamp }],
  'THIRD_PARTY_NOTICES.txt': [strToU8(notices), { mtime: fixedTimestamp }],
}, { level: 9 })

await mkdir(releaseDir, { recursive: true })
await writeFile(htmlAsset, offlineHtml)
await writeFile(zipAsset, zip)

function sha256(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex')
}

const checksumText = [
  `${sha256(offlineHtml)}  ${htmlName}`,
  `${sha256(zip)}  ${zipName}`,
  '',
].join('\n')
await writeFile(checksums, checksumText, 'ascii')

console.log(`Created release assets in ${releaseDir}`)
