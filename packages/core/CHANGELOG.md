# Changelog

## [2.0.0-beta.6](https://github.com/tada5hi/rapiq/compare/core-v2.0.0-beta.5...core-v2.0.0-beta.6) (2026-07-21)


### Features

* first-class not() negation in the public condition IR ([#812](https://github.com/tada5hi/rapiq/issues/812)) ([d63e0a3](https://github.com/tada5hi/rapiq/commit/d63e0a33776e6d9ad8a8a16fde9423a6ad0ff3b5)), closes [#811](https://github.com/tada5hi/rapiq/issues/811)

## [2.0.0-beta.5](https://github.com/tada5hi/rapiq/compare/core-v2.0.0-beta.4...core-v2.0.0-beta.5) (2026-07-21)


### Features

* **core:** request-context threading & per-parameter schema validate hooks ([#807](https://github.com/tada5hi/rapiq/issues/807)) ([605993c](https://github.com/tada5hi/rapiq/commit/605993c8a5ef120e1a0c931eba88971ca3ee052f))

## [2.0.0-beta.4](https://github.com/tada5hi/rapiq/compare/core-v2.0.0-beta.3...core-v2.0.0-beta.4) (2026-07-20)


### Features

* **typeorm:** add assertSchemaMatchesEntity validation helper ([#805](https://github.com/tada5hi/rapiq/issues/805)) ([7600255](https://github.com/tada5hi/rapiq/commit/7600255849e822de10e72b431912b69938c22774)), closes [#800](https://github.com/tada5hi/rapiq/issues/800)

## [2.0.0-beta.3](https://github.com/tada5hi/rapiq/compare/core-v2.0.0-beta.2...core-v2.0.0-beta.3) (2026-07-20)


### Bug Fixes

* **core:** restore index-signature relation keys & thread build-input DEPTH ([#793](https://github.com/tada5hi/rapiq/issues/793)) ([ccef05d](https://github.com/tada5hi/rapiq/commit/ccef05d36519cecb16b926879226a25d0529d657)), closes [#790](https://github.com/tada5hi/rapiq/issues/790)

## [2.0.0-beta.2](https://github.com/tada5hi/rapiq/compare/core-v2.0.0-beta.1...core-v2.0.0-beta.2) (2026-07-20)


### Features

* **core:** export AST node guard family ([#784](https://github.com/tada5hi/rapiq/issues/784)) ([001a24a](https://github.com/tada5hi/rapiq/commit/001a24a1ed9ed467e8bdce9d3a6383514c12d861)), closes [#774](https://github.com/tada5hi/rapiq/issues/774)
* **core:** forward DEPTH generic through QueryBuildInput ([#783](https://github.com/tada5hi/rapiq/issues/783)) ([d621977](https://github.com/tada5hi/rapiq/commit/d621977a065dfaf3a5582d59674578415aca6191)), closes [#776](https://github.com/tada5hi/rapiq/issues/776)
* **core:** widen schema key types for nullable relations and JSON columns ([#785](https://github.com/tada5hi/rapiq/issues/785)) ([afe2338](https://github.com/tada5hi/rapiq/commit/afe2338888aee658750552378c36f6924a0efb45)), closes [#777](https://github.com/tada5hi/rapiq/issues/777)
* first-class parameter masking for parse and decode ([#786](https://github.com/tada5hi/rapiq/issues/786)) ([5a0c8ca](https://github.com/tada5hi/rapiq/commit/5a0c8ca7e41f282ad4594616968db3d0292889d6)), closes [#778](https://github.com/tada5hi/rapiq/issues/778)

## [2.0.0-beta.1](https://github.com/tada5hi/rapiq/compare/core-v2.0.0-beta.0...core-v2.0.0-beta.1) (2026-07-19)


### Miscellaneous Chores

* **core:** Synchronize rapiq versions

## [2.0.0-beta.0](https://github.com/tada5hi/rapiq/compare/core-v1.0.0...core-v2.0.0-beta.0) (2026-07-17)


### ⚠ BREAKING CHANGES

* every elemMatch node now opens its own quantifier scope in @rapiq/memory - two elemMatches on one field (or an elemMatch beside a dotted sibling) bind independent elements (mongo semantics) instead of sharing one binding. $-prefixed keys are no longer accepted as field names in the build-layer filters object grammar. In the expression filter dialect, elemMatch is now a reserved keyword and $-prefixed words are reserved markers, so fields with these names no longer tokenize.
* the filters Validator type returns MaybeAsync<IFilter | undefined> (no void); relation aliases longer than 63 characters gain a hash suffix; TypeORM filter parameters are named rapiq_<n>_<i> instead of positional 0, 1, ...
* relation aliases now use length-prefixed path segments to avoid collisions.
* eq/ne/in/nin match strings case-insensitively on every adapter; previously case behavior followed the database collation (case-sensitive on postgres/sqlite/oracle and in @rapiq/memory).
* **core:** the parameter node interfaces (IFields, IFilters, IPagination, IRelations, ISorts) gained merge (and, or on IFilters) methods; custom implementations must provide them. QueryBuilder is deprecated in favor of defineQuery.
* **core:** schema defaults now apply in composite parsing even when a parameter is absent from the input; URLDecoder performs schema validation when constructed with a registry.
* **sql:** null filter values now emit IS NULL predicates instead of bound parameters; the mssql preset no longer throws for anchored string operators and throws AdapterError (not Error) for regex.
* **core:** the five Base*Parser classes, IInterpreter and several utils are no longer exported from @rapiq/core; sort relation failures throw SortParseError; disallowed filter/relations keys throw keyNotPermitted (ErrorCode.KEY_NOT_ALLOWED).
* package rapiq renamed

### Features

* add ITSELF self-reference marker for element-level $elemMatch and $all ([#770](https://github.com/tada5hi/rapiq/issues/770)) ([e1d5c4c](https://github.com/tada5hi/rapiq/commit/e1d5c4c0f4c94bcde359aa92cc118cd773641c03))
* add missing encoder/decoder capabilities + missing tests ([#699](https://github.com/tada5hi/rapiq/issues/699)) ([9f2e69f](https://github.com/tada5hi/rapiq/commit/9f2e69f71cd5a26a0e313f62077dc229bf72463b))
* add size array-length filter operator ([#771](https://github.com/tada5hi/rapiq/issues/771)) ([013bf06](https://github.com/tada5hi/rapiq/commit/013bf06be06d1aef808f50e9a5dc922ab36f75ab))
* case-insensitive string equality with per-field opt-out ([#762](https://github.com/tada5hi/rapiq/issues/762)) ([5821c59](https://github.com/tada5hi/rapiq/commit/5821c593497a5c779d72dd0b4494cc36991284b1))
* codec completion — round-trip subset law, expression url codec & registry ([#748](https://github.com/tada5hi/rapiq/issues/748)) ([42fc558](https://github.com/tada5hi/rapiq/commit/42fc5588975fcd5d5f82ed880b00310e64834e25))
* **core:** opt-in strict mode rejecting parameters without an allow-list ([#746](https://github.com/tada5hi/rapiq/issues/746)) ([0dc6d21](https://github.com/tada5hi/rapiq/commit/0dc6d21e5cb369889b160f77ab5ba06e8cf548b2))
* **core:** ResolutionScope resolution engine + public API cleanup ([#739](https://github.com/tada5hi/rapiq/issues/739)) ([1f76c4a](https://github.com/tada5hi/rapiq/commit/1f76c4a0eeb544d4656ef8a06e59282b9eb6d6da))
* **core:** shared parser orchestration, unified defaults, codec boundary decode ([#745](https://github.com/tada5hi/rapiq/issues/745)) ([56c6f34](https://github.com/tada5hi/rapiq/commit/56c6f34037bfbe899a4b5baff2920afb0e2fff14))
* **core:** typed build layer, condition helpers & query merge ([#747](https://github.com/tada5hi/rapiq/issues/747)) ([fd2fae7](https://github.com/tada5hi/rapiq/commit/fd2fae7d5b9611b0ff4633fa179dc527d98312aa))
* **core:** typed SchemaError for schema registry failures ([#761](https://github.com/tada5hi/rapiq/issues/761)) ([3de1d6a](https://github.com/tada5hi/rapiq/commit/3de1d6a310febf0a88af516478829746bd28dd43))
* enhance typing with interfaces and lesser coupling ([#700](https://github.com/tada5hi/rapiq/issues/700)) ([60f00b5](https://github.com/tada5hi/rapiq/commit/60f00b5b229ec129b788458ea04f7b9b4896e0bc))
* **parser-mongo:** mongodb query parser dialect ([#751](https://github.com/tada5hi/rapiq/issues/751)) ([d96711b](https://github.com/tada5hi/rapiq/commit/d96711b4d1d482761433cc879220c3a51ce88474))
* **sql:** fragment assembly, null semantics, MSSQL LIKE fallback, typed adapter errors ([#741](https://github.com/tada5hi/rapiq/issues/741)) ([7a5e439](https://github.com/tada5hi/rapiq/commit/7a5e4391b6de2eace89d0103f48c4fd128f2a1d4))


### Bug Fixes

* compound wrapping, anchored regex patterns, empty IN lists, sqlite preset ([#742](https://github.com/tada5hi/rapiq/issues/742)) ([6be65b4](https://github.com/tada5hi/rapiq/commit/6be65b4295d977a67047ee9203b6087a1ab2e9e7))
* **core:** correct isFilters discrimination and relation extract; add core test baseline ([#728](https://github.com/tada5hi/rapiq/issues/728)) ([4513b7d](https://github.com/tada5hi/rapiq/commit/4513b7d99a0c014e6d6322a9575ece3b5607ae86))
* **deps:** bump pathtrace in the majorprod group across 1 directory ([#733](https://github.com/tada5hi/rapiq/issues/733)) ([4a619e8](https://github.com/tada5hi/rapiq/commit/4a619e8da8b5210206f347983c30274c5a33196d))
* harden filter validation and adapter state preservation ([#766](https://github.com/tada5hi/rapiq/issues/766)) ([97e11d4](https://github.com/tada5hi/rapiq/commit/97e11d450e8596d6a90869d30453f363add82bb9))
* harden v2 beta release ([#763](https://github.com/tada5hi/rapiq/issues/763)) ([51a906a](https://github.com/tada5hi/rapiq/commit/51a906aa1e5d9e8e4bd1e4dc0f9fce8ec4aaddeb))
* make query properties non optional ([8115b8f](https://github.com/tada5hi/rapiq/commit/8115b8f2fe4db46ed5c380f2b0179a624fe7fafb))
* make query properties readonly ([42c6ba5](https://github.com/tada5hi/rapiq/commit/42c6ba56d5baaa1091ad406d9cfd8fb3195ecb4d))


### Code Refactoring

* rename rapiq package to @rapiq/core ([#694](https://github.com/tada5hi/rapiq/issues/694)) ([89ffc31](https://github.com/tada5hi/rapiq/commit/89ffc31b8a31286213de5a890199d88fbe160313))
