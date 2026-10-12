import { createServer, type Socket } from 'node:net'

/** An in-memory SMTP sink. It never relays mail outside this process. */
export async function sandboxSmtp() {
  const messages: string[] = []
  const sockets = new Set<Socket>()
  const server = createServer(socket => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => {})
    socket.write('220 localhost sandbox SMTP\r\n')
    let buffer = '', inData = false, data = ''
    socket.on('data', chunk => {
      buffer += chunk.toString()
      let index: number
      while ((index = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, index)
        buffer = buffer.slice(index + 2)
        if (inData) {
          if (line === '.') {
            messages.push(data); data = ''; inData = false
            socket.write('250 accepted\r\n')
          } else data += line + '\n'
        } else if (/^(EHLO|HELO)/.test(line)) socket.write('250-localhost\r\n250-AUTH PLAIN\r\n250 SIZE 1000000\r\n')
        else if (/^AUTH/.test(line)) socket.write('235 authenticated\r\n')
        else if (line === 'STARTTLS') socket.write('454 TLS unavailable in local fixture\r\n')
        else if (line === 'DATA') { inData = true; socket.write('354 continue\r\n') }
        else if (line === 'QUIT') { socket.write('221 bye\r\n'); socket.end() }
        else socket.write('250 OK\r\n')
      }
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return {
    messages,
    port: (server.address() as { port: number }).port,
    close: () => { for (const socket of sockets) socket.destroy(); return new Promise<void>(resolve => server.close(() => resolve())) },
  }
}

export function decodeSandboxMail(message: string) {
  const normalized = message.replace(/\r\n/g, '\n')
  const boundary = normalized.match(/boundary="([^"]+)"/)?.[1]
  const parts = boundary ? normalized.split('--' + boundary) : [normalized]
  return parts.map(part => {
    const split = part.indexOf('\n\n')
    if (split < 0) return ''
    const headers = part.slice(0, split), body = part.slice(split + 2)
    if (/Content-Transfer-Encoding:\s*base64/i.test(headers)) return Buffer.from(body.replace(/\s/g, ''), 'base64').toString('utf8')
    if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(headers)) {
      const decoded = body.replace(/=\n/g, '').replace(/=([a-f0-9]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      return Buffer.from(decoded, 'latin1').toString('utf8')
    }
    return body
  }).join('\n')
}
