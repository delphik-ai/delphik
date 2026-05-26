#!/usr/bin/env node
// Delphik skill login — opens browser, runs the GitHub OAuth + token issuance on the web,
// receives the dpk_ token via a one-shot local HTTP callback, and saves it to the per-host token
// file (~/.delphik/token for prod, ~/.delphik/token.dev for localhost). No copy/paste.
//
// usage: node scripts/login.mjs
//   env: DELPHIK_API (default https://posttrain.dev) — same selector as submit.mjs.
import http from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'

const API = process.env.DELPHIK_API || 'https://posttrain.dev'
const tokenPath = join(homedir(), '.delphik', /localhost|127\.0\.0\.1/.test(API) ? 'token.dev' : 'token')
const state = randomBytes(16).toString('hex')   // crypto-strong, not predictable
const apiOrigin = new URL(API).origin           // only this origin may POST tokens to the loopback

const server = http.createServer((req, res) => {
  // CORS: only the {API} origin (the /skill-auth page) is allowed to POST cross-origin. Browsers
  // enforce this; non-browser attackers can ignore CORS but still need to know our random port
  // AND the random state nonce (validated below) AND a token that starts with dpk_.
  const reqOrigin = req.headers.origin || ''
  const corsOk = reqOrigin === apiOrigin
  res.setHeader('access-control-allow-origin', corsOk ? apiOrigin : 'null')
  res.setHeader('access-control-allow-methods', 'POST, OPTIONS')
  res.setHeader('access-control-allow-headers', 'content-type')
  res.setHeader('vary', 'origin')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }
  const url = new URL(req.url, 'http://127.0.0.1')
  if (req.method === 'POST' && url.pathname === '/cb') {
    // Defence in depth: even if a CORS-flouting attacker reaches the port, refuse non-matching
    // Origin so a poisoned page on another site can't slip a token in.
    if (reqOrigin && reqOrigin !== apiOrigin) { res.writeHead(403); res.end('bad origin'); return }
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      try {
        const j = JSON.parse(body)
        if (j.state !== state) { res.writeHead(400); res.end('bad state'); return }
        const token = String(j.token || '')
        if (!token.startsWith('dpk_')) { res.writeHead(400); res.end('bad token'); return }
        mkdirSync(join(homedir(), '.delphik'), { recursive: true })
        writeFileSync(tokenPath, token, { mode: 0o600 })
        res.writeHead(200); res.end('ok')
        console.log(`✓ Signed in. Token saved to ${tokenPath}`)
        setTimeout(() => { server.close(); process.exit(0) }, 50)
      } catch (e) {
        res.writeHead(500); res.end('err: ' + (e instanceof Error ? e.message : String(e)))
      }
    })
    return
  }
  res.writeHead(404); res.end()
})

server.on('error', (e) => {
  console.error('login server error:', e instanceof Error ? e.message : String(e))
  process.exit(2)
})

server.listen(0, '127.0.0.1', () => {
  const addr = server.address()
  const port = typeof addr === 'object' && addr ? addr.port : 0
  const callback = `http://127.0.0.1:${port}/cb`
  const authUrl = `${API}/skill-auth?callback=${encodeURIComponent(callback)}&state=${state}`
  console.log(`Opening browser to sign in:\n  ${authUrl}\n(Waiting for sign-in… ⌃C to cancel.)`)
  const opener = process.platform === 'darwin' ? 'open'
              : process.platform === 'win32' ? 'start'
              : 'xdg-open'
  spawn(opener, [authUrl], { detached: true, stdio: 'ignore' }).unref()
})

// 5 min cap so a forgotten browser tab doesn't hang the skill forever.
setTimeout(() => {
  console.error('Timed out waiting for sign-in (5 min). Cancelled.')
  process.exit(2)
}, 5 * 60 * 1000)
