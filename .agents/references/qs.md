# qs

- **Repo**: https://github.com/ljharb/qs
- **Used by**: `@rapiq/codec-url` (dependency `qs@^6`)

`URLCodec.prepareDecode()` (`packages/codec-url/src/module.ts`) uses `qs.parse()` once to inspect the in-band codec identifier and filter shape before delegating. The internal simple/expression decoders consume the same parsed structure. Shared non-filter serializers produce `qs`-compatible bracket notation (`page[limit]=...`); legacy simple filters use `filter[name]=...`.

## Code Mappings

<!-- Append mappings as they are discovered (e.g. qs parse options vs decoder behavior, array format handling). -->
