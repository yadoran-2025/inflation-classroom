import { readFile } from 'node:fs/promises'

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
const releases = JSON.parse(await readFile(new URL('../src/data/releases.json', import.meta.url), 'utf8'))
const latest = releases[0]

if (!latest?.version || !latest?.date || !latest?.title || !Array.isArray(latest?.changes)) {
  throw new Error('Latest release note is incomplete.')
}

if (packageJson.version !== latest.version) {
  throw new Error(`package.json version ${packageJson.version} does not match latest release ${latest.version}.`)
}

console.log(`Release ${latest.version} validated.`)
