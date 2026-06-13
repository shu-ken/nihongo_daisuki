import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { writeFile, readFile, unlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'no file' }, { status: 400 })

  const id = randomUUID()
  const inputPath = join(tmpdir(), `${id}.aif`)
  const outputPath = join(tmpdir(), `${id}.wav`)

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(inputPath, buffer)

    await new Promise<void>((resolve, reject) => {
      execFile('ffmpeg', ['-y', '-i', inputPath, '-acodec', 'pcm_s16le', outputPath], (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    const wav = await readFile(outputPath)
    return new NextResponse(wav, {
      headers: { 'Content-Type': 'audio/wav' },
    })
  } finally {
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})
  }
}
