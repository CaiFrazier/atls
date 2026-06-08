#!/usr/bin/env node

/*
 * Copyright © 2025 Cai Frazier.
 * Example: Generate a status code breakdown report
 */

import { openAtlas } from '../dist/index.js';

const atlsPath = process.argv[2];

if (!atlsPath) {
  console.error('Usage: node status-report.mjs <path-to-atls-file>');
  process.exit(1);
}

async function main() {
  console.log(`Opening ${atlsPath}...\n`);
  
  const atlas = await openAtlas(atlsPath);
  
  console.log(`Atlas Info:`);
  console.log(`  Crawl Date: ${atlas.summary.timestamps.crawlStartedAt}`);
  console.log(`  Duration: ${(atlas.summary.timestamps.crawlDurationMs / 1000).toFixed(1)}s`);
  console.log(`  Total Pages: ${atlas.summary.stats.totalPages}\n`);
  
  // Status code breakdown from summary
  console.log('Status Code Distribution:\n');
  console.log('Code'.padEnd(10) + 'Count'.padEnd(10) + 'Percentage'.padEnd(15) + 'Bar');
  console.log('─'.repeat(60));
  
  const codes = Object.entries(atlas.summary.stats.statusCodes)
    .sort((a, b) => b[1] - a[1]);
  
  for (const [code, count] of codes) {
    const pct = ((count / atlas.summary.stats.totalPages) * 100).toFixed(1);
    const barLength = Math.floor((count / atlas.summary.stats.totalPages) * 40);
    const bar = '█'.repeat(barLength);
    
    console.log(
      code.padEnd(10) + 
      count.toString().padEnd(10) + 
      `${pct}%`.padEnd(15) + 
      bar
    );
  }
  
  // Find sample pages for non-200 codes
  console.log('\nSample Non-200 Pages:\n');
  
  for await (const page of atlas.readers.pageMetadata()) {
    if (page.statusCode !== 200) {
      console.log(`  [${page.statusCode}] ${page.url}`);
      if (page.discoveredFrom) {
        console.log(`         └─ Linked from: ${page.discoveredFrom}`);
      }
    }
  }
  
  console.log('\nDone!');
}

main().catch(console.error);
