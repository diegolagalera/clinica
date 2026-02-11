/**
 * Phase 3: Update controllers to extract db from req and pass to service calls.
 * 
 * For each controller:
 * 1. Replace direct `db.` references (from removed import) with `req.db!.`
 * 2. Add `req.db!` as first argument to all service function calls
 * 
 * This handles two controller patterns:
 * - asyncHandler: req is AuthenticatedRequest, has req.db
 * - Router: req is Request, needs (req as any).db
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const CONTROLLERS_DIR = path.join(ROOT, 'src/controllers');

// Map of service imports -> their function call patterns
// For each controller, we need to know what service functions are called
// so we can add db as first param

function processController(filePath: string): void {
    const fileName = path.basename(filePath);
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;
    let changeCount = 0;

    // Skip auth.controller.ts - already done
    if (fileName === 'auth.controller.ts') {
        console.log(`⏭  Skipping ${fileName} (already refactored)`);
        return;
    }

    // -----------------------------------------------------------------------
    // STEP 1: Replace direct db. references with req.db!. 
    // These were using the old global db import
    // Pattern: standalone `db.` at start of expression or after `await db.`
    // But NOT inside strings or comments
    // -----------------------------------------------------------------------

    // For asyncHandler controllers (AuthenticatedRequest), replace `db.` with `req.db!.`
    // We need to be careful: only replace `db.` that is a standalone db reference
    // (not part of another word like 'mongodb' or inside import paths)

    const lines = content.split('\n');
    const modifiedLines: string[] = [];

    for (const line of lines) {
        let modifiedLine = line;

        // Skip comments and import lines
        if (line.trim().startsWith('//') || line.trim().startsWith('*') ||
            line.trim().startsWith('import ') || line.includes("from '")) {
            modifiedLines.push(modifiedLine);
            continue;
        }

        // Replace standalone `db.` references (word boundary before db)
        // Common patterns: `await db.`, `const x = await db.`, `db.select`, `db.query`
        // Use word boundary matching
        if (/(?<![.\w])db\./.test(modifiedLine) && !modifiedLine.includes('req.db')) {
            modifiedLine = modifiedLine.replace(/(?<![.\w])db\./g, 'req.db!.');
            changeCount++;
        }

        modifiedLines.push(modifiedLine);
    }

    content = modifiedLines.join('\n');

    // -----------------------------------------------------------------------
    // STEP 2: Add req.db! as first argument to service function calls
    // Pattern: serviceName.functionName( -> serviceName.functionName(req.db!, 
    // We look for the service imports and match their call patterns
    // -----------------------------------------------------------------------

    // Find all service imports: import * as fooService from ... or import { fn } from ...service
    const serviceImportPattern = /import \* as (\w+) from ['"]\.\.\/services\//g;
    const serviceModules: string[] = [];
    let match;

    while ((match = serviceImportPattern.exec(content)) !== null) {
        serviceModules.push(match[1]);
    }

    // Also handle named imports from services
    const namedServicePattern = /import \{ ([^}]+) \} from ['"]\.\.\/services\//g;
    const namedFunctions: string[] = [];

    while ((match = namedServicePattern.exec(content)) !== null) {
        const fns = match[1].split(',').map((f: string) => f.trim());
        namedFunctions.push(...fns);
    }

    // Also handle class-based service imports: import { SomeService } from ...
    // These are called as SomeService.method()
    const classServicePattern = /import \{ (\w+Service) \} from ['"]\.\.\/services\//g;
    const classServices: string[] = [];

    while ((match = classServicePattern.exec(content)) !== null) {
        classServices.push(match[1]);
    }

    // Handle import of service instances: import { someService } from ...
    const instancePattern = /import \{ (\w+Service|\w+) \} from ['"]\.\.\/services\/([^'"]+)['"];/g;
    while ((match = instancePattern.exec(content)) !== null) {
        const importName = match[1];
        // If it starts with uppercase, it's a class; if lowercase, it's an instance
        if (importName[0] === importName[0].toUpperCase()) {
            if (!classServices.includes(importName)) {
                classServices.push(importName);
            }
        }
    }

    // For `import * as serviceModule` patterns:
    // Replace serviceModule.func(args) -> serviceModule.func(req.db!, args)
    for (const mod of serviceModules) {
        // Match: moduleName.functionName(  but NOT if already has req.db
        const callPattern = new RegExp(`${mod}\\.(\\w+)\\((?!req\\.db)`, 'g');
        const before = content;
        content = content.replace(callPattern, (fullMatch, funcName) => {
            // Check if this is a type reference or non-function call
            if (funcName === 'default' || funcName === 'prototype') return fullMatch;
            changeCount++;
            return `${mod}.${funcName}(req.db!, `;
        });
        // Fix empty args case: func(req.db!, ) -> func(req.db!)
        content = content.replace(new RegExp(`${mod}\\.\\w+\\(req\\.db!, \\)`, 'g'),
            (m) => m.replace(', )', ')'));
    }

    // For class-based service calls: ClassName.method(args) -> ClassName.method(req.db!, args)
    for (const cls of classServices) {
        const callPattern = new RegExp(`${cls}\\.(\\w+)\\((?!req\\.db)`, 'g');
        const before = content;
        content = content.replace(callPattern, (fullMatch, funcName) => {
            if (funcName === 'default' || funcName === 'prototype' || funcName === 'new') return fullMatch;
            changeCount++;
            return `${cls}.${funcName}(req.db!, `;
        });
        content = content.replace(new RegExp(`${cls}\\.\\w+\\(req\\.db!, \\)`, 'g'),
            (m) => m.replace(', )', ')'));
    }

    // For named function imports: func(args) -> func(req.db!, args)  
    // This is trickier - we need to be more careful
    for (const fn of namedFunctions) {
        if (!fn || fn === 'type' || fn === 'default') continue;
        // Only replace if it looks like a function call (not a type)
        const callPattern = new RegExp(`(?<![.\\w])${fn}\\((?!req\\.db)`, 'g');
        content = content.replace(callPattern, (fullMatch) => {
            changeCount++;
            return `${fn}(req.db!, `;
        });
        content = content.replace(new RegExp(`${fn}\\(req\\.db!, \\)`, 'g'),
            (m) => m.replace(', )', ')'));
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`✅ ${fileName}: ${changeCount} changes made`);
    } else {
        console.log(`⚠️  ${fileName}: no changes needed`);
    }
}

// Process all controllers
console.log('🎮 Updating controllers to use req.db:\n');
const controllerFiles = fs.readdirSync(CONTROLLERS_DIR)
    .filter((f: string) => f.endsWith('.ts'))
    .map((f: string) => path.join(CONTROLLERS_DIR, f));

for (const file of controllerFiles) {
    processController(file);
}

console.log('\n✅ Controller refactoring complete!');
