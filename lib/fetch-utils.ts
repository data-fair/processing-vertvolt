import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import { eventPromise } from '@data-fair/lib-utils/event-promise.js'
import SFTPClient from 'ssh2-sftp-client'
import FTPClient from 'ftp'

export class FileNotFoundError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'FileNotFoundError'
  }
}

export type FtpSftpCredentials = {
  username?: string
  password?: string
  privateKey?: string
}

/**
 * Download a single file from an FTP or SFTP server to a local path.
 * URL format: ftp://host:port/path or sftp://host:port/path
 * Throws FileNotFoundError if the remote file does not exist.
 */
export const downloadFile = async (
  url: string,
  credentials: FtpSftpCredentials,
  localPath: string
): Promise<void> => {
  const parsed = new URL(url)
  if (parsed.protocol === 'sftp:') {
    await downloadFileSFTP(parsed, credentials, localPath)
  } else if (parsed.protocol === 'ftp:' || parsed.protocol === 'ftps:') {
    await downloadFileFTP(parsed, credentials, localPath)
  } else {
    throw new Error(`Protocole non supporté : ${parsed.protocol}`)
  }
}

/**
 * List files in a remote FTP or SFTP directory.
 * URL format: ftp://host:port/path or sftp://host:port/path
 * Returns only file names (not directories).
 */
export const listFiles = async (
  url: string,
  credentials: FtpSftpCredentials
): Promise<string[]> => {
  const parsed = new URL(url)
  if (parsed.protocol === 'sftp:') {
    return listFilesSFTP(parsed, credentials)
  } else if (parsed.protocol === 'ftp:' || parsed.protocol === 'ftps:') {
    return listFilesFTP(parsed, credentials)
  } else {
    throw new Error(`Protocole non supporté : ${parsed.protocol}`)
  }
}

const downloadFileSFTP = async (
  url: URL,
  credentials: FtpSftpCredentials,
  localPath: string
): Promise<void> => {
  const sftp = new SFTPClient()
  try {
    await sftp.connect({
      host: url.hostname,
      port: url.port ? Number(url.port) : undefined,
      username: credentials.username,
      password: credentials.password,
      privateKey: credentials.privateKey
    })
    await sftp.get(url.pathname, localPath)
  } catch (err: any) {
    if (err.message?.toLowerCase().includes('no such file') || err.code === 'ENOENT') {
      throw new FileNotFoundError(`File not found: ${url.pathname}`)
    }
    throw err
  } finally {
    await sftp.end()
  }
}

const downloadFileFTP = async (
  url: URL,
  credentials: FtpSftpCredentials,
  localPath: string
): Promise<void> => {
  const ftp = new FTPClient()
  ftp.connect({
    host: url.hostname,
    port: url.port ? Number(url.port) : 21,
    user: credentials.username,
    password: credentials.password
  })
  await eventPromise(ftp, 'ready')
  try {
    const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
      ftp.get(url.pathname, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) reject(err)
        else resolve(stream)
      })
    })
    await pipeline(stream, createWriteStream(localPath))
  } catch (err: any) {
    if (err.message?.toLowerCase().includes('no such file') || err.message?.toLowerCase().includes('not found')) {
      throw new FileNotFoundError(`File not found: ${url.pathname}`)
    }
    throw err
  } finally {
    ftp.end()
  }
}

const listFilesSFTP = async (
  url: URL,
  credentials: FtpSftpCredentials
): Promise<string[]> => {
  const sftp = new SFTPClient()
  try {
    await sftp.connect({
      host: url.hostname,
      port: url.port ? Number(url.port) : undefined,
      username: credentials.username,
      password: credentials.password,
      privateKey: credentials.privateKey
    })
    const entries = await sftp.list(url.pathname)
    return entries.filter(f => f.type !== 'd').map(f => f.name)
  } finally {
    await sftp.end()
  }
}

const listFilesFTP = async (
  url: URL,
  credentials: FtpSftpCredentials
): Promise<string[]> => {
  const ftp = new FTPClient()
  ftp.connect({
    host: url.hostname,
    port: url.port ? Number(url.port) : 21,
    user: credentials.username,
    password: credentials.password
  })
  await eventPromise(ftp, 'ready')
  try {
    const entries = await new Promise<any[]>((resolve, reject) => {
      ftp.list(url.pathname, (err: Error | null, entries: any[]) => {
        if (err) reject(err)
        else resolve(entries)
      })
    })
    return entries.filter(e => e.type !== 'd').map(e => e.name)
  } finally {
    ftp.end()
  }
}
