/**
 * Fix internal function calls within services that are missing the db parameter.
 * 
 * Strategy: For each service file, find all functions that take db: Database as first param.
 * Then search the file for calls to those functions that don't pass db as first arg.
 * Add db as first arg where missing.
 * 
 * Also fix non-exported helper functions that use bare `db` without having it as parameter.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SERVICES_DIR = path.join(ROOT, 'src/services');

function processService(filePath: string): void {
    const fileName = path.basename(filePath);
    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;
    let changes = 0;

    // Step 1: Find all functions/methods that have `db: Database` as first param
    // Pattern: function name followed by (db: Database, ... or just the function being defined
    const funcWithDb = new Set<string>();

    // Match: export const funcName = async (db: Database,
    const exportPattern = /(?:export\s+)?(?:const|function)\s+(\w+)\s*=\s*(?:async\s*)?\(db:\s*Database/g;
    let m;
    while ((m = exportPattern.exec(content)) !== null) {
        funcWithDb.add(m[1]!);
    }

    // Match: async function funcName(db: Database,
    const funcDeclPattern = /(?:async\s+)?function\s+(\w+)\s*\(db:\s*Database/g;
    while ((m = funcDeclPattern.exec(content)) !== null) {
        funcWithDb.add(m[1]!);
    }

    // For class-based services, also match methods: methodName(db: Database,
    const methodPattern = /^\s+(?:async\s+)?(\w+)\s*\(db:\s*Database/gm;
    while ((m = methodPattern.exec(content)) !== null) {
        funcWithDb.add(m[1]!);
    }

    if (funcWithDb.size === 0) {
        console.log(`⏭  ${fileName}: No functions with db parameter found`);
        return;
    }

    // Step 2: For each function, find calls that don't pass db as first arg
    for (const funcName of funcWithDb) {
        // Pattern: funcName( but NOT funcName(db or funcName(db: Database
        // We need to handle: funcName(arg1, arg2) -> funcName(db, arg1, arg2)
        // But NOT: funcName(db, arg1) (already correct)

        // Match calls to this function
        const callPattern = new RegExp(
            `(?<![.\\w])${funcName}\\((?!db[,\\)])`,
            'g'
        );

        content = content.replace(callPattern, (match: string) => {
            // Don't modify the function definition itself
            // Check if this line contains the function definition
            const lineStart = content.lastIndexOf('\n', content.indexOf(match)) + 1;
            const line = content.substring(lineStart, content.indexOf('\n', lineStart + 1));

            if (line.includes(`${funcName} = `) || line.includes(`function ${funcName}`)) {
                return match;
            }

            changes++;
            return `${funcName}(db, `;
        });

        // Fix case where function has no other args: funcName(db, ) -> funcName(db)
        content = content.replace(new RegExp(`${funcName}\\(db, \\)`, 'g'), `${funcName}(db)`);
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`✅ ${fileName}: ${changes} internal calls fixed, functions with db: [${Array.from(funcWithDb).join(', ')}]`);
    } else {
        console.log(`⚠️  ${fileName}: no changes needed`);
    }
}

// Process all service files
console.log('🔧 Fixing internal db calls in services:\n');
const serviceFiles = fs.readdirSync(SERVICES_DIR)
    .filter(f => f.endsWith('.ts'))
    .map(f => path.join(SERVICES_DIR, f));

for (const file of serviceFiles) {
    processService(file);
}

console.log('\n✅ Internal call fixing complete!');
