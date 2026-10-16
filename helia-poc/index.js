import { createHelia } from 'helia'
import { unixfs } from '@helia/unixfs'

const sample = new TextEncoder().encode(
  'WasteWise Helia proof of concept: harmless public sample content.\n',
)

const helia = await createHelia().start()

try {
  const fs = unixfs(helia)
  const cid = await fs.addBytes(sample)
  const chunks = []

  for await (const chunk of fs.cat(cid)) {
    chunks.push(chunk)
  }

  const retrieved = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
  if (!retrieved.equals(Buffer.from(sample))) {
    throw new Error(`Retrieved bytes did not match content at ${cid}`)
  }

  console.log(`CID: ${cid}`)
  console.log(`Retrieved and verified ${retrieved.byteLength} bytes.`)
} finally {
  await helia.stop()
}
