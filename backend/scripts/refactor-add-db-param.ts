/**
 * Phase 2: Add `db: Database` as first parameter to all exported functions in services.
 * 
 * This script scans each service file for exported functions and adds `db: Database`
 * as the first parameter. It handles:
 * - export const funcName = async (params) => 
 * - export async function funcName(params)
 * - export class ClassName { async method(params) }
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const SERVICES_DIR = path.join(ROOT, 'src/services');

// Files already refactored or that shouldn't be changed
const SKIP_FILES = [
    'auth.service.ts',    // Already done
    'email.service.ts',   // Uses nodemailer, not db-dependent for all functions
    'storage.service.ts', // S3 operations, no db
    'assistant.service.ts', // AI operations
];

// Services where functions use db (match export const ... = async)
function addDbParamToService(filePath: string): void {
    const fileName = path.basename(filePath);
    if (SKIP_FILES.includes(fileName)) {
        console.log(`⏭  Skipping ${fileName}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf-8');
    const original = content;

    // Check if db is actually used in the file
    if (!content.includes('db.') && !content.includes('db,') && !content.includes('db)')) {
        console.log(`⏭  ${fileName}: no db usage found`);
        return;
    }

    // Pattern: export const funcName = async (param1: Type, ...) =>
    // Add db: Database as first param
    content = content.replace(
        /export const (\w+) = async \((?!\s*db\s*:)/g,
        'export const $1 = async (db: Database, '
    );

    // Fix double comma if function had no params: async (db: Database, ) =>
    content = content.replace(
        /async \(db: Database, \)/g,
        'async (db: Database)'
    );

    // Pattern for class methods:
    // export class ClassName {
    //   async methodName(params) {
    // We need to be more careful here
    content = content.replace(
        /(\s+)(async\s+\w+\s*)\((?!\s*db\s*:)/g,
        (match, indent, funcDecl) => {
            // Only add db: Database if the line before doesn't already have it
            if (match.includes('constructor') || match.includes('private') || match.includes('static')) {
                return match;
            }
            return `${indent}${funcDecl}(db: Database, `;
        }
    );

    // Fix class method empty params: async method(db: Database, ) {
    content = content.replace(
        /(\w+)\(db: Database, \)/g,
        '$1(db: Database)'
    );

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8');

        // Count changes
        const changes = content.split('db: Database').length - original.split('db: Database').length;
        console.log(`✅ ${fileName}: added db: Database to ${changes} function(s)`);
    } else {
        console.log(`⚠️  ${fileName}: no functions modified`);
    }
}

// Process all services
console.log('📦 Adding db: Database parameter to service functions:\n');
const serviceFiles = fs.readdirSync(SERVICES_DIR)
    .filter((f: string) => f.endsWith('.ts'))
    .map((f: string) => path.join(SERVICES_DIR, f));

for (const file of serviceFiles) {
    addDbParamToService(file);
}

console.log('\n✅ Parameter addition complete!');
