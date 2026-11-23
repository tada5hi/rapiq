/*
 * Copyright (c) 2026.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

import type { PendingKeyValidation } from '../../../src';
import {
    FiltersParseError,
    KeyResolutionErrorCode,
    Parameter,
    ResolutionScope,
    SchemaRegistry,
    defineSchema,
} from '../../../src';

function buildRegistry(filters: Record<string, any> = {}, post: Record<string, any> = {}) : SchemaRegistry {
    const local = new SchemaRegistry();

    local.add(defineSchema({
        name: 'post',
        filters: {
            allowed: ['id', 'slug', 'tags', 'author'],
            ...filters,
        },
        relations: { allowed: ['postTags'] },
        ...post,
    }));
    local.add(defineSchema({
        name: 'postTags',
        filters: { allowed: ['id', 'name'], relations: [] },
        schemaMapping: { post: 'post_ref' },
    }));
    local.add(defineSchema({
        name: 'post_ref',
        filters: { allowed: ['status'] },
    }));
    local.add(defineSchema({
        name: 'author',
        filters: { allowed: ['userId'] },
    }));

    return local;
}

const KEY_NOT_PERMITTED = (name: string) => ({
    success: false,
    code: KeyResolutionErrorCode.KEY_NOT_PERMITTED,
    input: name,
    segment: name,
});

describe('src/schema/resolver/module.ts (array operator targets, #1005)', () => {
    describe('checkArrayTarget', () => {
        it('should permit a non-relation target when arrays is undeclared', () => {
            const scope = ResolutionScope.for(buildRegistry(), Parameter.FILTERS, 'post');

            expect(scope.checkArrayTarget('id')).toBeUndefined();
        });

        it('should refuse a non-relation target under a strict scope when arrays is undeclared', () => {
            const scope = ResolutionScope.for(buildRegistry(), Parameter.FILTERS, 'post', { strict: true });

            expect(scope.checkArrayTarget('id')).toEqual(KEY_NOT_PERMITTED('id'));
        });

        it('should permit only the declared array columns', () => {
            const scope = ResolutionScope.for(buildRegistry({ arrays: ['tags'] }), Parameter.FILTERS, 'post');

            expect(scope.checkArrayTarget('id')).toEqual(KEY_NOT_PERMITTED('id'));
            expect(scope.checkArrayTarget('tags')).toBeUndefined();
        });

        it('should refuse every non-relation target for an empty arrays list', () => {
            const scope = ResolutionScope.for(buildRegistry({ arrays: [] }), Parameter.FILTERS, 'post');

            expect(scope.checkArrayTarget('id')).toEqual(KEY_NOT_PERMITTED('id'));
            expect(scope.checkArrayTarget('tags')).toEqual(KEY_NOT_PERMITTED('tags'));
        });

        it('should leave a relation target to checkRelationTarget', () => {
            const scope = ResolutionScope.for(buildRegistry({ arrays: [] }), Parameter.FILTERS, 'post');

            expect(scope.checkArrayTarget('postTags')).toBeUndefined();
        });

        it('should throw under a throwing policy', () => {
            const scope = ResolutionScope.for(buildRegistry({ arrays: [] }), Parameter.FILTERS, 'post', { throwOnFailure: true });

            expect(() => scope.checkArrayTarget('id')).toThrow(FiltersParseError);
        });

        it('should permit everything on an unbound scope', () => {
            const scope = ResolutionScope.for(buildRegistry(), Parameter.FILTERS, undefined, { strict: true });

            expect(scope.checkArrayTarget('id')).toBeUndefined();
        });

        it('should gate an array-operator target in resolveKey', () => {
            const scope = ResolutionScope.for(buildRegistry({ arrays: [] }), Parameter.FILTERS, 'post');

            expect(scope.resolveKey('id', 'id', { relationTarget: true })).toEqual(KEY_NOT_PERMITTED('id'));
            // a scalar comparison is never an array-operator target
            expect(scope.resolveKey('id').success).toBeTruthy();
        });
    });

    describe('descendElement', () => {
        it('should resolve a dotted interior key as an opaque element path', () => {
            const obligationSink : PendingKeyValidation[] = [];
            const scope = ResolutionScope.for(buildRegistry(), Parameter.FILTERS, 'post', {
                throwOnFailure: true,
                obligationSink,
            });

            const interior = scope.descendElement('id');

            expect(interior).toBeInstanceOf(ResolutionScope);

            const resolved = (interior as ResolutionScope<'filters'>).resolveKey('author.userId');

            expect(resolved).toMatchObject({
                success: true,
                path: [],
                name: 'author.userId',
            });
            expect(obligationSink).toEqual([]);
        });

        it('should refuse an invalid identifier inside an element scope', () => {
            const scope = ResolutionScope.for(buildRegistry(), Parameter.FILTERS, 'post');
            const interior = scope.descendElement('id') as ResolutionScope<'filters'>;

            expect(interior.resolveKey('author.1x')).toMatchObject({
                success: false,
                code: KeyResolutionErrorCode.KEY_INVALID,
            });
        });

        it('should keep element scopes at every nesting depth', () => {
            const scope = ResolutionScope.for(buildRegistry(), Parameter.FILTERS, 'post');
            const interior = scope.descendElement('tags') as ResolutionScope<'filters'>;
            const nested = interior.descendElement('author') as ResolutionScope<'filters'>;

            expect(nested.resolveKey('userId.x')).toMatchObject({
                success: true,
                path: [],
                name: 'userId.x',
            });
            expect(nested.checkArrayTarget('anything')).toBeUndefined();

            const itself = ResolutionScope.forElement(interior);

            expect(itself.resolveKey('author.userId')).toMatchObject({ success: true, name: 'author.userId' });
        });

        it('should bind a relation target to its schema and gate every hop', () => {
            const scope = ResolutionScope.for(buildRegistry(), Parameter.FILTERS, 'post');
            const interior = scope.descendElement('postTags') as ResolutionScope<'filters'>;

            expect(interior.resolveKey('id').success).toBeTruthy();
            expect(interior.resolveKey('post.status')).toMatchObject({
                success: false,
                code: KeyResolutionErrorCode.PATH_NOT_PERMITTED,
            });
        });

        it('should keep single-segment keys but refuse dotted ones inside a declared but unregistered relation', () => {
            const local = buildRegistry({}, { relations: { allowed: ['postTags', 'comments'] } });
            const scope = ResolutionScope.for(local, Parameter.FILTERS, 'post');
            const interior = scope.descendElement('comments') as ResolutionScope<'filters'>;

            expect(interior.resolveKey('body')).toMatchObject({
                success: true,
                path: [],
                name: 'body',
            });
            expect(interior.resolveKey('author.userId')).toEqual({
                success: false,
                code: KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE,
                input: 'author.userId',
                segment: 'author',
            });

            // a nested interior never regains dotted access
            const nested = interior.descendElement('replies') as ResolutionScope<'filters'>;

            expect(nested.resolveKey('text').success).toBeTruthy();
            expect(nested.resolveKey('author.userId')).toMatchObject({
                success: false,
                code: KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE,
            });

            const throwing = ResolutionScope.for(local, Parameter.FILTERS, 'post', { throwOnFailure: true });
            const thrown = throwing.descendElement('comments') as ResolutionScope<'filters'>;

            expect(() => thrown.resolveKey('author.userId')).toThrow(FiltersParseError);
        });

        it('should refuse an array-operator target inside a declared but unregistered relation', () => {
            const local = buildRegistry({}, { relations: { allowed: ['postTags', 'comments'] } });
            const scope = ResolutionScope.for(local, Parameter.FILTERS, 'post');
            const interior = scope.descendElement('comments') as ResolutionScope<'filters'>;

            expect(interior.resolveKey('author', 'author', { relationTarget: true })).toEqual({
                success: false,
                code: KeyResolutionErrorCode.SCHEMA_UNRESOLVABLE,
                input: 'author',
                segment: 'author',
            });
            // a plain comparison on the same column stays a column
            expect(interior.resolveKey('author').success).toBeTruthy();

            const throwing = ResolutionScope.for(local, Parameter.FILTERS, 'post', { throwOnFailure: true });
            const thrown = throwing.descendElement('comments') as ResolutionScope<'filters'>;

            expect(() => thrown.resolveKey('author', 'author', { relationTarget: true })).toThrow(FiltersParseError);

            // an array column interior keeps accepting array-operator targets
            const array = scope.descendElement('tags') as ResolutionScope<'filters'>;

            expect(array.resolveKey('sub', 'sub', { relationTarget: true }).success).toBeTruthy();
        });

        it('should refuse every key inside a declared but unregistered relation under strict mode', () => {
            const local = buildRegistry({}, { relations: { allowed: ['postTags', 'comments'] } });
            const scope = ResolutionScope.for(local, Parameter.FILTERS, 'post', { strict: true });
            const interior = scope.descendElement('comments') as ResolutionScope<'filters'>;

            expect(interior.resolveKey('body')).toMatchObject({
                success: false,
                code: KeyResolutionErrorCode.KEY_NOT_PERMITTED,
            });
        });

        it('should treat a listed array column as an element scope even when a schema shares its name', () => {
            const obligationSink : PendingKeyValidation[] = [];
            const local = buildRegistry({ arrays: ['author'] }, { relations: { allowed: ['postTags', 'author'] } });
            const scope = ResolutionScope.for(local, Parameter.FILTERS, 'post', { obligationSink });

            expect(scope.checkArrayTarget('author')).toBeUndefined();
            expect(scope.resolveKey('author', 'author', { relationTarget: true }).success).toBeTruthy();
            expect(obligationSink).toEqual([]);

            const interior = scope.descendElement('author') as ResolutionScope<'filters'>;

            expect(interior.resolveKey('anything.deep')).toMatchObject({
                success: true,
                path: [],
                name: 'anything.deep',
            });
        });

        it('should keep registry descent by name on an unbound root scope', () => {
            const scope = ResolutionScope.for(buildRegistry(), Parameter.FILTERS);
            const interior = scope.descendElement('author') as ResolutionScope<'filters'>;

            expect(interior.resolveKey('userId').success).toBeTruthy();
            expect(interior.resolveKey('nope')).toMatchObject({
                success: false,
                code: KeyResolutionErrorCode.KEY_NOT_PERMITTED,
            });
        });
    });

    describe('describe', () => {
        it('should expose the arrays declaration', () => {
            expect(buildRegistry({ arrays: ['tags'] }).getOrFail('post').describe().filters?.arrays).toEqual(['tags']);
            expect(buildRegistry().getOrFail('post').describe().filters?.arrays).toBeNull();
        });
    });
});
