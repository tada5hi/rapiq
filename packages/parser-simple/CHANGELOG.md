# Changelog

## [2.2.0](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.1.0...parser-simple-v2.2.0) (2026-08-16)


### Features

* call-time throwOnFailure override, mod as a dialect capability, structured feature tag ([#912](https://github.com/tada5hi/rapiq/issues/912)) ([cac568a](https://github.com/tada5hi/rapiq/commit/cac568ab04c25ad4ccce3e509c462e8319f4047a))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.1.0 to ^2.2.0
  * peerDependencies
    * @rapiq/core bumped from ^2.1.0 to ^2.2.0

## [2.1.0](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0...parser-simple-v2.1.0) (2026-08-12)


### Miscellaneous Chores

* **parser-simple:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0 to ^2.1.0
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0 to ^2.1.0

## [2.0.0](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.20...parser-simple-v2.0.0) (2026-08-11)


### Miscellaneous Chores

* release 2.0.0 ([f71d633](https://github.com/tada5hi/rapiq/commit/f71d633c43031d9f1b6134ebe5775c74ad8b59f3))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.20 to ^2.0.0
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.20 to ^2.0.0

## [2.0.0-beta.20](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.19...parser-simple-v2.0.0-beta.20) (2026-08-10)


### ⚠ BREAKING CHANGES

* a pagination key containing a __proto__, constructor or prototype segment now raises a typed ParseError instead of being ignored.

### Features

* schema index declarations (indexed filters and sort) ([#895](https://github.com/tada5hi/rapiq/issues/895)) ([121e6cd](https://github.com/tada5hi/rapiq/commit/121e6cdbf73b903f6767b3be3b81f4640481639d))


### Bug Fixes

* close pre-GA decode-hardening gaps ([#893](https://github.com/tada5hi/rapiq/issues/893)) ([883ac09](https://github.com/tada5hi/rapiq/commit/883ac094fa7c61f77b914ff22db15026e81a41cd))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.19 to ^2.0.0-beta.20
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.19 to ^2.0.0-beta.20

## [2.0.0-beta.19](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.18...parser-simple-v2.0.0-beta.19) (2026-08-07)


### ⚠ BREAKING CHANGES

* **core:** `Filters.merge()` and `mergeQueries()` compose filters as an ordered logical AND. Same-field conditions are no longer replaced by the receiver, they are retained as conjuncts, so two `eq` conditions on one field now select nothing instead of the receiver's value. Replace transient UI state before building the query, or select the current `IFilters` node and pass only that to `defineQuery`.

### Bug Fixes

* **core:** make query filter merges conjunctive ([#890](https://github.com/tada5hi/rapiq/issues/890)) ([489c9c0](https://github.com/tada5hi/rapiq/commit/489c9c0e4f99b8fc1465418b01fb48f52e96de81))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.18 to ^2.0.0-beta.19
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.18 to ^2.0.0-beta.19

## [2.0.0-beta.18](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.17...parser-simple-v2.0.0-beta.18) (2026-08-06)


### Miscellaneous Chores

* **parser-simple:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.17 to ^2.0.0-beta.18
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.17 to ^2.0.0-beta.18

## [2.0.0-beta.17](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.16...parser-simple-v2.0.0-beta.17) (2026-08-05)


### ⚠ BREAKING CHANGES

* a key path containing a `__proto__`, `constructor` or `prototype` segment now raises a typed ParseError instead of being accepted.

### Bug Fixes

* close the pre-GA release blockers ([#883](https://github.com/tada5hi/rapiq/issues/883)) ([e652be7](https://github.com/tada5hi/rapiq/commit/e652be70385495e7c287375074f6227e305e4094))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.16 to ^2.0.0-beta.17
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.16 to ^2.0.0-beta.17

## [2.0.0-beta.16](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.15...parser-simple-v2.0.0-beta.16) (2026-08-04)


### Miscellaneous Chores

* **parser-simple:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.15 to ^2.0.0-beta.16
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.15 to ^2.0.0-beta.16

## [2.0.0-beta.15](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.14...parser-simple-v2.0.0-beta.15) (2026-08-03)


### ⚠ BREAKING CHANGES

* and()/or() on an empty receiver wrap the injected conditions in a nested group instead of adopting them directly; a replace-merge against such a tree now throws FILTERS_NOT_FLAT.

### Bug Fixes

* close the pre-GA audit gaps in code and docs ([#871](https://github.com/tada5hi/rapiq/issues/871)) ([72923b0](https://github.com/tada5hi/rapiq/commit/72923b08aa8050a4c5a425d2b891d1f84fc67083))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.14 to ^2.0.0-beta.15
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.14 to ^2.0.0-beta.15

## [2.0.0-beta.14](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.13...parser-simple-v2.0.0-beta.14) (2026-08-02)


### ⚠ BREAKING CHANGES

* select the execution mode by calling parse() or parseAsync(), not via an options flag.

### Miscellaneous Chores

* pre-GA cleanup sweep ([#866](https://github.com/tada5hi/rapiq/issues/866)) ([f4e7b68](https://github.com/tada5hi/rapiq/commit/f4e7b68e32ebae902e1a742a09f57606c1b84f5c))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.13 to ^2.0.0-beta.14
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.13 to ^2.0.0-beta.14

## [2.0.0-beta.13](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.12...parser-simple-v2.0.0-beta.13) (2026-07-28)


### ⚠ BREAKING CHANGES

* @rapiq/sql, @rapiq/typeorm, @rapiq/prisma and @rapiq/memory are now published as @rapiq/adapter-sql, @rapiq/adapter-typeorm, @rapiq/adapter-prisma and @rapiq/adapter-memory.

### Code Refactoring

* prefix backend packages with adapter- ([#858](https://github.com/tada5hi/rapiq/issues/858)) ([1f43ad4](https://github.com/tada5hi/rapiq/commit/1f43ad4b52dcea413e2004d8d17d4a09afcd2d02))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.12 to ^2.0.0-beta.13
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.12 to ^2.0.0-beta.13

## [2.0.0-beta.12](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.11...parser-simple-v2.0.0-beta.12) (2026-07-28)


### Features

* widen the filters validate hook to return any condition ([#856](https://github.com/tada5hi/rapiq/issues/856)) ([a54dba5](https://github.com/tada5hi/rapiq/commit/a54dba51ef43d88099004815c35600bad199455c))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.11 to ^2.0.0-beta.12
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.11 to ^2.0.0-beta.12

## [2.0.0-beta.11](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.10...parser-simple-v2.0.0-beta.11) (2026-07-27)


### Miscellaneous Chores

* **parser-simple:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.10 to ^2.0.0-beta.11
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.10 to ^2.0.0-beta.11

## [2.0.0-beta.10](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.9...parser-simple-v2.0.0-beta.10) (2026-07-26)


### Features

* condition-returning and batched key validation hooks ([#830](https://github.com/tada5hi/rapiq/issues/830)) ([#837](https://github.com/tada5hi/rapiq/issues/837)) ([ceda0b4](https://github.com/tada5hi/rapiq/commit/ceda0b4f6ef51f2ac1f68b17da1fa7f635d44532))
* **prisma:** add prisma adapter ([#838](https://github.com/tada5hi/rapiq/issues/838)) ([83c9c94](https://github.com/tada5hi/rapiq/commit/83c9c94db1d178b17798c9b106f99cdf027cfb65))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.9 to ^2.0.0-beta.10
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.9 to ^2.0.0-beta.10

## [2.0.0-beta.9](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.8...parser-simple-v2.0.0-beta.9) (2026-07-24)


### Miscellaneous Chores

* **parser-simple:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.8 to ^2.0.0-beta.9
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.8 to ^2.0.0-beta.9

## [2.0.0-beta.8](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.7...parser-simple-v2.0.0-beta.8) (2026-07-24)


### Miscellaneous Chores

* **parser-simple:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.7 to ^2.0.0-beta.8
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.7 to ^2.0.0-beta.8

## [2.0.0-beta.7](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.6...parser-simple-v2.0.0-beta.7) (2026-07-22)


### Features

* **core:** authorize relation paths traversed by filters/fields/sort ([#815](https://github.com/tada5hi/rapiq/issues/815)) ([#816](https://github.com/tada5hi/rapiq/issues/816)) ([1f98ff3](https://github.com/tada5hi/rapiq/commit/1f98ff3f577eb702d1b55ee6e7b3a3a166d5c44a))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7

## [2.0.0-beta.6](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.5...parser-simple-v2.0.0-beta.6) (2026-07-21)


### Miscellaneous Chores

* **parser-simple:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6

## [2.0.0-beta.5](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.4...parser-simple-v2.0.0-beta.5) (2026-07-21)


### Features

* **core:** request-context threading & per-parameter schema validate hooks ([#807](https://github.com/tada5hi/rapiq/issues/807)) ([605993c](https://github.com/tada5hi/rapiq/commit/605993c8a5ef120e1a0c931eba88971ca3ee052f))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5

## [2.0.0-beta.4](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.3...parser-simple-v2.0.0-beta.4) (2026-07-20)


### Bug Fixes

* **parser-simple:** decode boolean filter input to an equality condition ([#801](https://github.com/tada5hi/rapiq/issues/801)) ([9240251](https://github.com/tada5hi/rapiq/commit/9240251934cf033c195be3a4dc2fab9f1d2db695)), closes [#799](https://github.com/tada5hi/rapiq/issues/799)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4

## [2.0.0-beta.3](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.2...parser-simple-v2.0.0-beta.3) (2026-07-20)


### Miscellaneous Chores

* **parser-simple:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3

## [2.0.0-beta.2](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.1...parser-simple-v2.0.0-beta.2) (2026-07-20)


### Features

* first-class parameter masking for parse and decode ([#786](https://github.com/tada5hi/rapiq/issues/786)) ([5a0c8ca](https://github.com/tada5hi/rapiq/commit/5a0c8ca7e41f282ad4594616968db3d0292889d6)), closes [#778](https://github.com/tada5hi/rapiq/issues/778)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2

## [2.0.0-beta.1](https://github.com/tada5hi/rapiq/compare/parser-simple-v2.0.0-beta.0...parser-simple-v2.0.0-beta.1) (2026-07-19)


### Miscellaneous Chores

* **parser-simple:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1

## [2.0.0-beta.0](https://github.com/tada5hi/rapiq/compare/parser-simple-v1.0.0...parser-simple-v2.0.0-beta.0) (2026-07-17)


### ⚠ BREAKING CHANGES

* the filters Validator type returns MaybeAsync<IFilter | undefined> (no void); relation aliases longer than 63 characters gain a hash suffix; TypeORM filter parameters are named rapiq_<n>_<i> instead of positional 0, 1, ...
* **codec-url:** remove @rapiq/codec-url-simple and @rapiq/codec-url-expression as standalone packages.
* relation aliases now use length-prefixed path segments to avoid collisions.
* **core:** schema defaults now apply in composite parsing even when a parameter is absent from the input; URLDecoder performs schema validation when constructed with a registry.
* **core:** the five Base*Parser classes, IInterpreter and several utils are no longer exported from @rapiq/core; sort relation failures throw SortParseError; disallowed filter/relations keys throw keyNotPermitted (ErrorCode.KEY_NOT_ALLOWED).
* package rapiq renamed

### Features

* add missing encoder/decoder capabilities + missing tests ([#699](https://github.com/tada5hi/rapiq/issues/699)) ([9f2e69f](https://github.com/tada5hi/rapiq/commit/9f2e69f71cd5a26a0e313f62077dc229bf72463b))
* codec completion — round-trip subset law, expression url codec & registry ([#748](https://github.com/tada5hi/rapiq/issues/748)) ([42fc558](https://github.com/tada5hi/rapiq/commit/42fc5588975fcd5d5f82ed880b00310e64834e25))
* **codec-url:** consolidate URL codecs ([#765](https://github.com/tada5hi/rapiq/issues/765)) ([b7a7f41](https://github.com/tada5hi/rapiq/commit/b7a7f41be791324e8069ab4d800b41f329efd729))
* **core:** opt-in strict mode rejecting parameters without an allow-list ([#746](https://github.com/tada5hi/rapiq/issues/746)) ([0dc6d21](https://github.com/tada5hi/rapiq/commit/0dc6d21e5cb369889b160f77ab5ba06e8cf548b2))
* **core:** ResolutionScope resolution engine + public API cleanup ([#739](https://github.com/tada5hi/rapiq/issues/739)) ([1f76c4a](https://github.com/tada5hi/rapiq/commit/1f76c4a0eeb544d4656ef8a06e59282b9eb6d6da))
* **core:** shared parser orchestration, unified defaults, codec boundary decode ([#745](https://github.com/tada5hi/rapiq/issues/745)) ([56c6f34](https://github.com/tada5hi/rapiq/commit/56c6f34037bfbe899a4b5baff2920afb0e2fff14))
* enhance typing with interfaces and lesser coupling ([#700](https://github.com/tada5hi/rapiq/issues/700)) ([60f00b5](https://github.com/tada5hi/rapiq/commit/60f00b5b229ec129b788458ea04f7b9b4896e0bc))
* replace interpreter with visitor pattern ([#668](https://github.com/tada5hi/rapiq/issues/668)) ([a9c4ae5](https://github.com/tada5hi/rapiq/commit/a9c4ae5f56de8e87da22176711bbc45ef8addb24))
* split in codec-url, parser-simple & parser-expression package ([#663](https://github.com/tada5hi/rapiq/issues/663)) ([4be53ad](https://github.com/tada5hi/rapiq/commit/4be53adfa653bb31ef40a2f0fddb1b70f494f91e))
* startsWith, endsWith & contains operator ([#675](https://github.com/tada5hi/rapiq/issues/675)) ([40bf127](https://github.com/tada5hi/rapiq/commit/40bf1278b7901f5a82f0516900bcca2eccc405dc))


### Bug Fixes

* harden filter validation and adapter state preservation ([#766](https://github.com/tada5hi/rapiq/issues/766)) ([97e11d4](https://github.com/tada5hi/rapiq/commit/97e11d450e8596d6a90869d30453f363add82bb9))
* harden v2 beta release ([#763](https://github.com/tada5hi/rapiq/issues/763)) ([51a906a](https://github.com/tada5hi/rapiq/commit/51a906aa1e5d9e8e4bd1e4dc0f9fce8ec4aaddeb))
* make query properties non optional ([8115b8f](https://github.com/tada5hi/rapiq/commit/8115b8f2fe4db46ed5c380f2b0179a624fe7fafb))
* make query properties readonly ([42c6ba5](https://github.com/tada5hi/rapiq/commit/42c6ba56d5baaa1091ad406d9cfd8fb3195ecb4d))


### Code Refactoring

* rename rapiq package to @rapiq/core ([#694](https://github.com/tada5hi/rapiq/issues/694)) ([89ffc31](https://github.com/tada5hi/rapiq/commit/89ffc31b8a31286213de5a890199d88fbe160313))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^1.0.0 to ^2.0.0-beta.0
  * peerDependencies
    * @rapiq/core bumped from ^1.0.0 to ^2.0.0-beta.0
