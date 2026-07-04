/*
 * Copyright 2026 Cai Frazier
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Example: Validate an Atlas archive
 * 
 * This example demonstrates how to use the validate() function
 * to check an Atlas archive for schema compliance and referential integrity.
 * 
 * Usage:
 *   npx tsx examples/validate-archive.ts <path-to.atls>
 */

import { validate } from "../src/index.js";

async function main() {
  const atlsPath = process.argv[2];
  
  if (!atlsPath) {
    console.error("Usage: npx tsx examples/validate-archive.ts <path-to.atls>");
    process.exit(1);
  }
  
  console.log(`Validating: ${atlsPath}\n`);
  
  const result = await validate(atlsPath, {
    checkIntegrity: true,
    checkBrokenLinks: true,
    checkManifest: true,
    maxIssues: 1000,
  });
  
  console.log("Validation Results:");
  console.log("===================");
  console.log(`Valid: ${result.valid ? "✅ YES" : "❌ NO"}`);
  console.log(`\nStatistics:`);
  console.log(`  Pages checked:  ${result.stats.pageMetadataChecked}`);
  console.log(`  Edges checked:  ${result.stats.navigationEdgesChecked}`);
  console.log(`  Assets checked: ${result.stats.assetsChecked}`);
  console.log(`  Errors found:   ${result.stats.errorsFound}`);
  console.log(`  Warnings found: ${result.stats.warningsFound}`);
  
  if (result.issues.length > 0) {
    console.log(`\nIssues (${result.issues.length}):`);
    console.log("==================");
    
    // Group by severity
    const errors = result.issues.filter((i) => i.severity === "error");
    const warnings = result.issues.filter((i) => i.severity === "warning");
    const info = result.issues.filter((i) => i.severity === "info");
    
    if (errors.length > 0) {
      console.log(`\nErrors (${errors.length}):`);
      errors.forEach((issue, idx) => {
        console.log(`  ${idx + 1}. [${issue.code}] ${issue.message}`);
        if (issue.details) {
          console.log(`     Details: ${JSON.stringify(issue.details)}`);
        }
      });
    }
    
    if (warnings.length > 0) {
      console.log(`\nWarnings (${warnings.length}):`);
      warnings.slice(0, 10).forEach((issue, idx) => {
        console.log(`  ${idx + 1}. [${issue.code}] ${issue.message}`);
      });
      if (warnings.length > 10) {
        console.log(`  ... and ${warnings.length - 10} more warnings`);
      }
    }
    
    if (info.length > 0) {
      console.log(`\nInfo (${info.length}):`);
      info.slice(0, 5).forEach((issue, idx) => {
        console.log(`  ${idx + 1}. [${issue.code}] ${issue.message}`);
      });
      if (info.length > 5) {
        console.log(`  ... and ${info.length - 5} more info messages`);
      }
    }
  } else {
    console.log("\n✅ No issues found!");
  }
  
  process.exit(result.valid ? 0 : 1);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
