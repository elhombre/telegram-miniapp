import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const clientFilePath = join(process.cwd(), 'src/generated/prisma/client.ts')

if (!existsSync(clientFilePath)) {
  process.exit(0)
}

const source = readFileSync(clientFilePath, 'utf8')

const importBlock =
  "import * as path from 'node:path'\nimport { fileURLToPath } from 'node:url'\nglobalThis['__dirname'] = path.dirname(fileURLToPath(import.meta.url))\n"

if (!source.includes(importBlock)) {
  process.exit(0)
}

const patched = source.replace(importBlock, "globalThis['__dirname'] = __dirname\n")

writeFileSync(clientFilePath, patched, 'utf8')
