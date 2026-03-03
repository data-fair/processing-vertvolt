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

export type SftpConnectionOptions = {
  host: string
  port?: number
  username: string
  password?: string
  privateKey?: string
}

export type FtpConnectionOptions = {
  host: string
  port?: number
  username?: string
  password?: string
}

/**
 * Download a single file from an SFTP server to a local path.
 * Throws FileNotFoundError if the remote file does not exist.
 */
export const downloadFileSFTP = async (
  connection: SftpConnectionOptions,
  remotePath: string,
  localPath: string
): Promise<void> => {
  const sftp = new SFTPClient()
  try {
    await sftp.connect({
      host: connection.host,
      port: connection.port,
      username: connection.username,
      password: connection.password,
      privateKey: connection.privateKey
    })
    await sftp.get(remotePath, localPath)
  } catch (err: any) {
    if (err.message?.toLowerCase().includes('no such file') || err.code === 'ENOENT') {
      throw new FileNotFoundError(`File not found: ${remotePath}`)
    }
    throw err
  } finally {
    await sftp.end()
  }
}

/**
 * Download a single file from an FTP server to a local path.
 * Throws FileNotFoundError if the remote file does not exist.
 */
export const downloadFileFTP = async (
  connection: FtpConnectionOptions,
  remotePath: string,
  localPath: string
): Promise<void> => {
  const ftp = new FTPClient()
  ftp.connect({
    host: connection.host,
    port: connection.port ?? 21,
    user: connection.username,
    password: connection.password
  })
  await eventPromise(ftp, 'ready')
  try {
    const stream = await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
      ftp.get(remotePath, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) reject(err)
        else resolve(stream)
      })
    })
    await pipeline(stream, createWriteStream(localPath))
  } catch (err: any) {
    if (err.message?.toLowerCase().includes('no such file') || err.message?.toLowerCase().includes('not found')) {
      throw new FileNotFoundError(`File not found: ${remotePath}`)
    }
    throw err
  } finally {
    ftp.end()
  }
}

/**
 * List files in a remote SFTP directory.
 * Returns only file names (not directories).
 */
export const listFilesSFTP = async (
  connection: SftpConnectionOptions,
  folderPath: string
): Promise<string[]> => {
  const sftp = new SFTPClient()
  try {
    await sftp.connect({
      host: connection.host,
      port: connection.port,
      username: connection.username,
      password: connection.password,
      privateKey: connection.privateKey
    })
    const entries = await sftp.list(folderPath)
    return entries.filter(f => f.type !== 'd').map(f => f.name)
  } finally {
    await sftp.end()
  }
}

/**
 * List files in a remote FTP directory.
 * Returns only file names (not directories).
 */
export const listFilesFTP = async (
  connection: FtpConnectionOptions,
  folderPath: string
): Promise<string[]> => {
  const ftp = new FTPClient()
  ftp.connect({
    host: connection.host,
    port: connection.port ?? 21,
    user: connection.username,
    password: connection.password
  })
  await eventPromise(ftp, 'ready')
  try {
    const entries = await new Promise<any[]>((resolve, reject) => {
      ftp.list(folderPath, (err: Error | null, entries: any[]) => {
        if (err) reject(err)
        else resolve(entries)
      })
    })
    return entries.filter(e => e.type !== 'd').map(e => e.name)
  } finally {
    ftp.end()
  }
}
