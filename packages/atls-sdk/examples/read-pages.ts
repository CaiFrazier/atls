/*
 * Copyright © 2025 Cai Frazier.
 * All rights reserved. Unauthorized copying, modification, or distribution is prohibited.
 * Proprietary and confidential.
 */

/**
 * Example: Read and display pages from an Atlas archive
 * 
 * This example demonstrates how to:
 * - Open an Atlas archive
 * - Iterate through pages
 * - Access page metadata (URL, title, status, render mode)
 * - Display content statistics
 * 
 * Usage:
 *   npx tsx examples/read-pages.ts <path-to.atls>
 */

import { openAtlas } from "../src/index.js";

async function main() {
  const atlsPath = process.argv[2];
  
  if (!atlsPath) {
    console.error("Usage: npx tsx examples/read-pages.ts <path-to.atls>");
    process.exit(1);
  }
  
  console.log(`Opening: ${atlsPath}\n`);
  
  // Open the archive
  const atlas = await openAtlas(atlsPath);
  
  // Read manifest
  const manifest = atlas.manifest;
  console.log("Archive Information:");
  console.log("===================");
  console.log(`Atlas Version:   ${manifest.atlasVersion}`);
  console.log(`Format Version:  ${manifest.formatVersion}`);
  console.log(`Generator:       ${manifest.generator}`);
  console.log(`Owner:           ${manifest.owner.name}`);
  console.log(`Incomplete:      ${manifest.incomplete ? "Yes" : "No"}`);
  console.log(`Created:         ${manifest.createdAt}`);
  
  if (atlas.summary) {
    console.log(`\nCrawl Summary:`);
    console.log(`  Pages:   ${atlas.summary.stats.totalPages}`);
    console.log(`  Edges:   ${atlas.summary.stats.totalEdges}`);
    console.log(`  Assets:  ${atlas.summary.stats.totalAssets}`);
    console.log(`  Errors:  ${atlas.summary.stats.totalErrors}`);
    console.log(`  Domain:  ${atlas.summary.identity.domain}`);
    console.log(`  Reason:  ${atlas.summary.crawlContext.completionReason}`);
  }
  
  console.log("\n");
  console.log("Pages in Archive:");
  console.log("=================\n");
  
  let pageCount = 0;
  let totalHtmlSize = 0;
  const statusCounts: Record<number, number> = {};
  
  // Iterate through all pages
  for await (const page of atlas.readers.pageMetadata()) {
    pageCount++;
    
    // Track status codes
    statusCounts[page.statusCode] = (statusCounts[page.statusCode] || 0) + 1;
    
    // Track HTML size (using textSample as proxy for content)
    if (page.textSample) {
      totalHtmlSize += page.textSample.length;
    }
    
    // Display page info
    console.log(`${pageCount}. ${page.url}`);
    console.log(`   Status: ${page.statusCode} | Depth: ${page.depth} | Mode: ${page.renderMode}`);
    console.log(`   Title:  ${page.title || "(no title)"}`);
    
    if (page.canonicalResolved) {
      console.log(`   Canon:  ${page.canonicalResolved}`);
    }
    
    console.log("");
    
    // Limit output for large archives
    if (pageCount >= 20) {
      console.log("... (showing first 20 pages only)\n");
      break;
    }
  }
  
  // Summary statistics
  console.log("Statistics:");
  console.log("===========");
  console.log(`Total Pages:     ${pageCount}`);
  console.log(`Total Text Size: ${(totalHtmlSize / 1024).toFixed(2)} KB`);
  console.log(`Avg Text Size:   ${pageCount > 0 ? (totalHtmlSize / pageCount / 1024).toFixed(2) : 0} KB`);
  
  console.log("\nStatus Code Distribution:");
  Object.entries(statusCounts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([status, count]) => {
      console.log(`  ${status}: ${count} page(s)`);
    });
  
  console.log("\n✅ Done!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
