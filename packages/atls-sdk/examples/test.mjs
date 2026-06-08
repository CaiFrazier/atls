#!/usr/bin/env node

/*
 * SDK Test - Verify openAtlas and select APIs work correctly
 */

import { openAtlas, select } from '../dist/index.js';
import assert from 'node:assert';

const atlsPath = process.argv[2] || '../../tmp/accessibility-test.atls';

async function test() {
  console.log(`Testing Atlas SDK with ${atlsPath}\n`);
  
  // Test 1: openAtlas
  console.log('Test 1: openAtlas()');
  const atlas = await openAtlas(atlsPath);
  
  assert(atlas.manifest, 'Should have manifest');
  assert(atlas.summary, 'Should have summary');
  assert(atlas.datasets, 'Should have datasets');
  assert(atlas.readers, 'Should have readers');
  
  console.log(`  ✓ Atlas version: ${atlas.manifest.atlasVersion}`);
  console.log(`  ✓ Total pages: ${atlas.summary.stats.totalPages}`);
  console.log(`  ✓ Datasets: ${[...atlas.datasets].join(', ')}`);
  
  // Test 2: readers.pageMetadata()
  console.log('\nTest 2: readers.pageMetadata()');
  let pageCount = 0;
  for await (const page of atlas.readers.pageMetadata()) {
    assert(page.url, 'Page should have url');
    assert(typeof page.statusCode === 'number', 'Page should have statusCode');
    pageCount++;
    if (pageCount === 1) {
      console.log(`  ✓ First page: ${page.url} (${page.statusCode})`);
    }
  }
  console.log(`  ✓ Iterated ${pageCount} pages`);
  
  // Test 3: readers.accessibility()
  if (atlas.datasets.has('accessibility')) {
    console.log('\nTest 3: readers.accessibility()');
    let accCount = 0;
    for await (const record of atlas.readers.accessibility()) {
      assert(record.pageUrl, 'Record should have pageUrl');
      assert(typeof record.missingAltCount === 'number', 'Should have missingAltCount');
      accCount++;
      if (accCount === 1) {
        console.log(`  ✓ First record: ${record.pageUrl}`);
        console.log(`    - Missing alt: ${record.missingAltCount}`);
        console.log(`    - Heading order: [${record.headingOrder.join(', ')}]`);
      }
    }
    console.log(`  ✓ Iterated ${accCount} accessibility records`);
  }
  
  // Test 4: select with filter
  console.log('\nTest 4: select() with filter');
  let selectCount = 0;
  for await (const page of select(atlsPath, {
    dataset: 'page_metadata',
    where: (p) => p.statusCode === 200,
    fields: ['url', 'statusCode']
  })) {
    assert(page.url, 'Should have url');
    assert(page.statusCode === 200, 'Should be 200');
    selectCount++;
  }
  console.log(`  ✓ Selected ${selectCount} pages with statusCode=200`);
  
  // Test 5: select with limit
  console.log('\nTest 5: select() with limit');
  let limitCount = 0;
  for await (const page of select(atlsPath, {
    dataset: 'page_metadata',
    limit: 1
  })) {
    assert(page.url, 'Should have url');
    limitCount++;
  }
  assert(limitCount <= 1, 'Should respect limit');
  console.log(`  ✓ Limit respected: ${limitCount} records`);
  
  console.log('\n✅ All tests passed!');
}

test().catch((error) => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});
