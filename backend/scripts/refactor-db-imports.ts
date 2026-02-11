/**
 * Refactoring script: Replace global `db` import with `db: Database` parameter in all services.
 * 
 * For SERVICES: 
 * 1. Replace `import { db } from '../db/index.js'` with `import type { Database } from '../db/index.js'`
 * 2. Add `db: Database` as the first parameter to all exported async functions
 * 
 * For CONTROLLERS:
 * 1. Remove `import { db } from '../db/index.js'`
 * 2. Replace direct `db.` usage with `authReq.db.`
 * 
 * For JOBS:
 * 1. Replace `import { db } from '../db/index.js'` with `import type { Database } from '../db/index.js'`
 * 2. Wrap with tenant iteration
 * 
 * This script is intentionally conservative - it only handles the import line replacement.
 * The parameter addition in functions is logged but needs manual review for complex cases.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SERVICES_DIR = path.join(ROOT, 'src/services');
const CONTROLLERS_DIR = path.join(ROOT, 'src/controllers');
const JOBS_DIR = path.join(ROOT, 'src/jobs');

// Files already refactored
const SKIP_FILES = ['auth.service.ts'];

function refactorServiceImport(filePath: string): void {
    const fileName = path.basename(filePath);
    if (SKIP_FILES.includes(fileName)) {
        console.log(`⏭  Skipping ${fileName} (already refactored)`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;

    // Pattern 1: import { db } from '../db/index.js'; 
    // Pattern 2: import { db } from '../db/index.js';  (with other named imports on same line)

    if (content.includes("import { db }") && content.includes("from '../db/index.js'")) {
        // Simple case: only importing db
        content = content.replace(
            /import \{ db \} from '\.\.\/db\/index\.js';/,
            "import type { Database } from '../db/index.js';"
        );
    } else if (content.includes("db") && content.includes("from '../db/index.js'")) {
        // Complex case: db imported alongside other things - just ensure type import exists
        // This handles cases like: import { db, migrationClient } from '../db/index.js'
        content = content.replace(
            /import \{([^}]*)\bdb\b([^}]*)\} from '\.\.\/db\/index\.js';/,
            (match, before, after) => {
                const otherImports = `${before}${after}`.replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
                let result = "import type { Database } from '../db/index.js';";
                if (otherImports) {
                    result = `import { ${otherImports} } from '../db/index.js';\n${result}`;
                }
                return result;
            }
        );
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`✅ Refactored import in ${fileName}`);
    } else {
        console.log(`⚠️  No change in ${fileName} (pattern not matched)`);
    }
}

function refactorControllerImport(filePath: string): void {
    const fileName = path.basename(filePath);
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;

    // Remove the db import from controllers - they'll use req.db instead
    if (content.includes("import { db }") && content.includes("from '../db/index.js'")) {
        content = content.replace(
            /import \{ db \} from '\.\.\/db\/index\.js';\n?/,
            ''
        );
    } else if (content.includes("db") && content.includes("from '../db/index.js'")) {
        content = content.replace(
            /import \{([^}]*)\bdb\b([^}]*)\} from '\.\.\/db\/index\.js';/,
            (match, before, after) => {
                const otherImports = `${before}${after}`.replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '').trim();
                if (otherImports) {
                    return `import { ${otherImports} } from '../db/index.js';`;
                }
                return '';
            }
        );
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`✅ Removed db import from ${fileName}`);
    } else {
        console.log(`⚠️  No change in ${fileName}`);
    }
}

// Process services
console.log('\n📦 SERVICES:');
const serviceFiles = fs.readdirSync(SERVICES_DIR)
    .filter(f => f.endsWith('.ts'))
    .map(f => path.join(SERVICES_DIR, f));

for (const file of serviceFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes("from '../db/index.js'") && content.includes('db')) {
        refactorServiceImport(file);
    }
}

// Process controllers
console.log('\n🎮 CONTROLLERS:');
const controllerFiles = fs.readdirSync(CONTROLLERS_DIR)
    .filter(f => f.endsWith('.ts'))
    .map(f => path.join(CONTROLLERS_DIR, f));

for (const file of controllerFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes("from '../db/index.js'") && content.includes('db')) {
        refactorControllerImport(file);
    }
}

// Process jobs
console.log('\n⏰ JOBS:');
const jobFiles = fs.readdirSync(JOBS_DIR)
    .filter(f => f.endsWith('.ts'))
    .map(f => path.join(JOBS_DIR, f));

for (const file of jobFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    if (content.includes("from '../db/index.js'") && content.includes('db')) {
        refactorServiceImport(file);
    }
}

console.log('\n✅ Import refactoring complete!');
console.log('\n⚠️  NEXT STEPS:');
console.log('1. Add `db: Database` parameter to all exported functions in services');
console.log('2. Extract `const { db } = req as AuthenticatedRequest` in controllers');
console.log('3. Pass `db` from controllers to service calls');
console.log('4. Wrap job functions with tenant iteration');
