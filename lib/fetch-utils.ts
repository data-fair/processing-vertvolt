import SFTPClient from 'ssh2-sftp-client'

export class FileNotFoundError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'FileNotFoundError'
  }
}

export type SftpCredentials = {
  username?: string
  password?: string
  privateKey?: string
}

/**
 * Download a single file from an SFTP server to a local path.
 * URL format: sftp://host:port/path
 * Throws FileNotFoundError if the remote file does not exist.
 */
export const downloadFile = async (
  url: string,
  credentials: SftpCredentials,
  localPath: string
): Promise<void> => {
  const parsed = new URL(url)
  if (parsed.protocol !== 'sftp:') {
    throw new Error(`Protocole non supporté : ${parsed.protocol}. Seul sftp:// est supporté.`)
  }
  const sftp = new SFTPClient()
  try {
    await sftp.connect({
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : undefined,
      username: credentials.username,
      password: credentials.password,
      privateKey: credentials.privateKey
    })
    const remotePath = decodeURIComponent(parsed.pathname)
    await sftp.get(remotePath, localPath)
  } catch (err: any) {
    if (err.message?.toLowerCase().includes('no such file') || err.code === 'ENOENT') {
      throw new FileNotFoundError(`File not found: ${decodeURIComponent(parsed.pathname)}`)
    }
    throw err
  } finally {
    await sftp.end()
  }
}

/**
 * List files in a remote SFTP directory.
 * URL format: sftp://host:port/path
 * Returns only file names (not directories).
 */
export const listFiles = async (
  url: string,
  credentials: SftpCredentials
): Promise<string[]> => {
  const parsed = new URL(url)
  if (parsed.protocol !== 'sftp:') {
    throw new Error(`Protocole non supporté : ${parsed.protocol}. Seul sftp:// est supporté.`)
  }
  const sftp = new SFTPClient()
  try {
    await sftp.connect({
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : undefined,
      username: credentials.username,
      password: credentials.password,
      privateKey: credentials.privateKey
    })
    const entries = await sftp.list(decodeURIComponent(parsed.pathname))
    return entries.filter(f => f.type !== 'd').map(f => f.name)
  } finally {
    await sftp.end()
  }
}
