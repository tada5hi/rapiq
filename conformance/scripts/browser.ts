/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

/**
 * Runs @rapiq/core's browser entry with the WASM binding in Chromium, on a
 * page served WITHOUT cross-origin isolation (an ordinary site): bundles a
 * small app the way a client would (browser conditions, `await ready()`,
 * @rapiq/adapter-memory on top), serves it and checks the results.
 *
 * Prerequisites: `npm run build`, `npm run build:binding:wasm
 * --workspace=packages/core/node`, Chromium (PLAYWRIGHT_CHROMIUM or the
 * preinstalled /opt/pw-browsers build) and playwright-core
 * (`npm i --no-save playwright-core`).
 *
 * Run: node --experimental-strip-types conformance/scripts/browser.ts
 */

/* eslint-disable no-console */

import { 
    copyFileSync, 
    mkdirSync, 
    readFileSync, 
    writeFileSync, 
} from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

const root = fileURLToPath(new URL('../..', import.meta.url));
const binding = join(root, 'packages/core/node/binding');
const out = join(root, 'target/browser-conformance');

mkdirSync(out, { recursive: true });

const entry = join(out, 'entry.js');
writeFileSync(entry, `
import { and, eq, gte, ready, planCondition } from '@rapiq/core';
import { compileFilters } from '@rapiq/adapter-memory';

window.run = async () => {
    let beforeReady;
    try {
        planCondition(eq('a', 1));
        beforeReady = 'no error';
    } catch (e) {
        beforeReady = e.code;
    }

    await ready();

    const predicate = compileFilters(and(eq('name', 'peter'), gte('age', 18)));
    const records = [{ name: 'Peter', age: 30 }, { name: 'Peter', age: 10 }, { name: 'Hans', age: 40 }];

    return {
        beforeReady,
        matches: records.map((record) => predicate(record)),
        dateIdentity: planCondition(gte('created_at', new Date(0))).value instanceof Date,
    };
};
`);

const bundle = await rolldown({
    input: entry,
    platform: 'browser',
    cwd: join(root, 'packages/core/node'),
    resolve: {
        conditionNames: ['browser', 'import', 'default'],
        alias: { '@rapiq/core-wasm32-wasip1': join(binding, 'rapiq-core.wasip1-browser.js') },
    },
});
await bundle.write({ dir: out, format: 'esm' });

// the glue resolves its .wasm next to itself (new URL(..., import.meta.url))
copyFileSync(join(binding, 'rapiq-core.wasm32-wasip1.wasm'), join(out, 'rapiq-core.wasm32-wasip1.wasm'));
writeFileSync(join(out, 'index.html'), '<!doctype html><meta charset="utf-8"><script type="module" src="./entry.js"></script>');

const types : Record<string, string> = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.wasm': 'application/wasm',
};

// deliberately no COOP/COEP headers: an ordinary, non-isolated page
const server = createServer((request, response) => {
    const path = join(out, (request.url ?? '/').split('?')[0] === '/' ? 'index.html' : (request.url as string).slice(1));
    let body : Buffer;
    try {
        body = readFileSync(path);
    } catch {
        response.writeHead(404);
        response.end();
        return;
    }

    response.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    response.end(body);
});
await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
const { port } = server.address() as { port: number };

const { chromium } = await import('playwright-core');
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => typeof (window as { run?: unknown }).run === 'function');

    const isolated = await page.evaluate(() => globalThis.crossOriginIsolated);
    const result = await page.evaluate(() => (window as unknown as { run: () => Promise<unknown> }).run());
    const expected = {
        beforeReady: 'bindingUnavailable', 
        matches: [true, false, false], 
        dateIdentity: true, 
    };

    console.log('crossOriginIsolated:', isolated);
    console.log('result:', JSON.stringify(result));

    if (isolated || JSON.stringify(result) !== JSON.stringify(expected)) {
        console.error('expected:', JSON.stringify(expected), 'on a non-isolated page');
        process.exitCode = 1;
    }
} finally {
    await browser.close();
    server.close();
}
