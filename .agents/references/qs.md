# qs

- **Repo**: https://github.com/ljharb/qs
- **Used by**: `@rapiq/codec-url-simple` (dependency `qs@^6`)

`URLDecoder` (`packages/codec-url-simple/src/decoder/module.ts`) uses `qs.parse()` to turn a raw URL query string into the nested object structure that the `Simple*Parser` classes consume. `URLEncoder` produces `qs`-compatible bracket notation (`filter[name]=...`, `page[limit]=...`).

## Code Mappings

<!-- Append mappings as they are discovered (e.g. qs parse options vs decoder behavior, array format handling). -->
