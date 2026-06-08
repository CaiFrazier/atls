#!/usr/bin/env node

/*
 * Copyright © 2025 Cai Frazier.
 * Example: Find images with missing alt text from accessibility stream
 */

import { openAtlas, select } from '../dist/index.js';

const atlsPath = process.argv[2];

if (!atlsPath) {
  console.error('Usage: node missing-alt.mjs <path-to-atls-file>');
  process.exit(1);
}

async function main() {
  console.log(`Opening ${atlsPath}...\n`);
  
  const atlas = await openAtlas(atlsPath);
  
  // Check if accessibility dataset is present
  if (!atlas.datasets.has('accessibility')) {
    console.error('Error: This archive does not contain accessibility data.');
    console.error('Crawl with accessibility enabled to use this example.');
    process.exit(1);
  }
  
  console.log(`Atlas Info:`);
  console.log(`  Total Pages: ${atlas.summary.stats.totalPages}`);
  console.log(`  Accessibility Records: ${atlas.summary.stats.totalAccessibilityRecords || 0}\n`);
  
  console.log('Pages with Missing Alt Text:\n');
  console.log('Page URL'.padEnd(60) + 'Missing Count');
  console.log('─'.repeat(80));
  
  let count = 0;
  let totalMissing = 0;
  
  // Use select API for efficient streaming with filter
  for await (const record of select(atlsPath, {
    dataset: 'accessibility',
    where: (a) => a.missingAltCount > 0,
    limit: 50
  })) {
    count++;
    totalMissing += record.missingAltCount;
    
    const url = record.pageUrl.length > 58 
      ? record.pageUrl.substring(0, 55) + '...' 
      : record.pageUrl;
    
    console.log(url.padEnd(60) + record.missingAltCount);
    
    // Show sample sources for first 5 pages
    if (count <= 5 && record.missingAltSources && record.missingAltSources.length > 0) {
      const samples = record.missingAltSources.slice(0, 3);
      for (const src of samples) {
        const shortSrc = src.length > 70 ? src.substring(0, 67) + '...' : src;
        console.log(`    └─ ${shortSrc}`);
      }
    }
  }
  
  console.log('\n' + '─'.repeat(80));
  console.log(`Total: ${count} pages with ${totalMissing} missing alt attributes`);
  console.log('\nDone!');
}

main().catch(console.error);
