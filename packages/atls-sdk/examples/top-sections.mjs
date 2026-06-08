#!/usr/bin/env node

/*
 * Copyright © 2025 Cai Frazier.
 * Example: Find and display the 10 largest sections by page count
 */

import { openAtlas } from '../dist/index.js';

const atlsPath = process.argv[2];

if (!atlsPath) {
  console.error('Usage: node top-sections.mjs <path-to-atls-file>');
  process.exit(1);
}

async function main() {
  console.log(`Opening ${atlsPath}...\n`);
  
  const atlas = await openAtlas(atlsPath);
  
  console.log(`Atlas Info:`);
  console.log(`  Version: ${atlas.manifest.atlasVersion}`);
  console.log(`  Total Pages: ${atlas.summary.stats.totalPages}`);
  console.log(`  Crawl Duration: ${(atlas.summary.timestamps.crawlDurationMs / 1000).toFixed(1)}s`);
  console.log(`  Datasets: ${[...atlas.datasets].join(', ')}\n`);
  
  // Count pages per section
  const sectionCounts = new Map();
  
  console.log('Analyzing sections...');
  for await (const page of atlas.readers.pageMetadata()) {
    const section = page.section || '/';
    sectionCounts.set(section, (sectionCounts.get(section) || 0) + 1);
  }
  
  // Sort by count descending
  const sorted = [...sectionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  console.log('\nTop 10 Sections by Page Count:\n');
  console.log('Section'.padEnd(40) + 'Pages');
  console.log('─'.repeat(50));
  
  for (const [section, count] of sorted) {
    console.log(section.padEnd(40) + count);
  }
  
  console.log('\nDone!');
}

main().catch(console.error);
