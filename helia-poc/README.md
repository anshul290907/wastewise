# WasteWise Helia proof of concept

This isolated Node.js script adds harmless sample text to a Helia node, prints
its content identifier (CID), reads the bytes back from that same node, and
checks that they match. It does not read or upload WasteWise reports or other
user data.

## Requirements

- Node.js 20 or newer (the repository environment was checked with Node.js 24)
- pnpm 10.22.0, matching the repository's declared package manager

## Run

From the repository root:

```sh
cd helia-poc
pnpm install
pnpm start
```

A successful run prints a CID and a message confirming that the retrieved
bytes matched.

## Limitations

- This is a local demonstration. It uses Helia's default node and blockstore
  configuration; no durable datastore or backup is configured, so do not rely
  on data surviving process restarts.
- Retrieval is from the same running node. Reachability from other peers depends
  on networking, connectivity, and whether another node can obtain the blocks;
  a printed CID alone does not guarantee public availability or persistence.
- CIDs identify content but do not make it private. Never put personal,
  confidential, or real report data in this proof of concept.
- Nothing here is integrated with the WasteWise UI, API, authentication, or
  TiDB. This does not change the production app or its deployment configuration.
