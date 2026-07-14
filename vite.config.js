import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

function readGitValue(args, fallback) {
  try { return execFileSync('git', args, { encoding: 'utf8' }).trim() || fallback }
  catch { return fallback }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const deploymentSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_SHA
  const commitSha = deploymentSha || readGitValue(['rev-parse', 'HEAD'], 'unavailable')
  const sourceState = deploymentSha ? 'clean' : (readGitValue(['status', '--porcelain'], '') ? 'dirty' : 'clean')
  const metadata = {
    appVersion: packageJson.version,
    commitSha,
    environment: process.env.VERCEL_ENV || process.env.DEPLOYMENT_ENV || mode,
    buildTimestamp: new Date().toISOString(),
    sourceState,
  }
  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_GLOWDOCKET_BUILD_METADATA': JSON.stringify(metadata),
    },
  }
})
