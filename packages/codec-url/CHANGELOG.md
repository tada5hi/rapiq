# Changelog

## [2.1.0](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0...codec-url-v2.1.0) (2026-08-12)


### Miscellaneous Chores

* **codec-url:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0 to ^2.1.0
    * @rapiq/parser-expression bumped from ^2.0.0 to ^2.1.0
    * @rapiq/parser-simple bumped from ^2.0.0 to ^2.1.0
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0 to ^2.1.0
    * @rapiq/parser-expression bumped from ^2.0.0 to ^2.1.0
    * @rapiq/parser-simple bumped from ^2.0.0 to ^2.1.0

## [2.0.0](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.20...codec-url-v2.0.0) (2026-08-11)


### Miscellaneous Chores

* release 2.0.0 ([f71d633](https://github.com/tada5hi/rapiq/commit/f71d633c43031d9f1b6134ebe5775c74ad8b59f3))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.20 to ^2.0.0
    * @rapiq/parser-expression bumped from ^2.0.0-beta.20 to ^2.0.0
    * @rapiq/parser-simple bumped from ^2.0.0-beta.20 to ^2.0.0
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.20 to ^2.0.0
    * @rapiq/parser-expression bumped from ^2.0.0-beta.20 to ^2.0.0
    * @rapiq/parser-simple bumped from ^2.0.0-beta.20 to ^2.0.0

## [2.0.0-beta.20](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.19...codec-url-v2.0.0-beta.20) (2026-08-10)


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
    * @rapiq/parser-expression bumped from ^2.0.0-beta.19 to ^2.0.0-beta.20
    * @rapiq/parser-simple bumped from ^2.0.0-beta.19 to ^2.0.0-beta.20
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.19 to ^2.0.0-beta.20
    * @rapiq/parser-expression bumped from ^2.0.0-beta.19 to ^2.0.0-beta.20
    * @rapiq/parser-simple bumped from ^2.0.0-beta.19 to ^2.0.0-beta.20

## [2.0.0-beta.19](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.18...codec-url-v2.0.0-beta.19) (2026-08-07)


### ⚠ BREAKING CHANGES

* **core:** `Filters.merge()` and `mergeQueries()` compose filters as an ordered logical AND. Same-field conditions are no longer replaced by the receiver, they are retained as conjuncts, so two `eq` conditions on one field now select nothing instead of the receiver's value. Replace transient UI state before building the query, or select the current `IFilters` node and pass only that to `defineQuery`.

### Bug Fixes

* **core:** make query filter merges conjunctive ([#890](https://github.com/tada5hi/rapiq/issues/890)) ([489c9c0](https://github.com/tada5hi/rapiq/commit/489c9c0e4f99b8fc1465418b01fb48f52e96de81))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.18 to ^2.0.0-beta.19
    * @rapiq/parser-expression bumped from ^2.0.0-beta.18 to ^2.0.0-beta.19
    * @rapiq/parser-simple bumped from ^2.0.0-beta.18 to ^2.0.0-beta.19
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.18 to ^2.0.0-beta.19
    * @rapiq/parser-expression bumped from ^2.0.0-beta.18 to ^2.0.0-beta.19
    * @rapiq/parser-simple bumped from ^2.0.0-beta.18 to ^2.0.0-beta.19

## [2.0.0-beta.18](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.17...codec-url-v2.0.0-beta.18) (2026-08-06)


### ⚠ BREAKING CHANGES

* **core:** ICondition implementations must provide immutable seal() behavior; the optional Condition base is now abstract.

### Bug Fixes

* **core:** make condition composition extensible ([#887](https://github.com/tada5hi/rapiq/issues/887)) ([f4627b8](https://github.com/tada5hi/rapiq/commit/f4627b89532c24ec65617596da6b29ab6ebe7fa3))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.17 to ^2.0.0-beta.18
    * @rapiq/parser-expression bumped from ^2.0.0-beta.17 to ^2.0.0-beta.18
    * @rapiq/parser-simple bumped from ^2.0.0-beta.17 to ^2.0.0-beta.18
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.17 to ^2.0.0-beta.18
    * @rapiq/parser-expression bumped from ^2.0.0-beta.17 to ^2.0.0-beta.18
    * @rapiq/parser-simple bumped from ^2.0.0-beta.17 to ^2.0.0-beta.18

## [2.0.0-beta.17](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.16...codec-url-v2.0.0-beta.17) (2026-08-05)


### ⚠ BREAKING CHANGES

* a key path containing a `__proto__`, `constructor` or `prototype` segment now raises a typed ParseError instead of being accepted.

### Bug Fixes

* close the pre-GA release blockers ([#883](https://github.com/tada5hi/rapiq/issues/883)) ([e652be7](https://github.com/tada5hi/rapiq/commit/e652be70385495e7c287375074f6227e305e4094))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.16 to ^2.0.0-beta.17
    * @rapiq/parser-expression bumped from ^2.0.0-beta.16 to ^2.0.0-beta.17
    * @rapiq/parser-simple bumped from ^2.0.0-beta.16 to ^2.0.0-beta.17
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.16 to ^2.0.0-beta.17
    * @rapiq/parser-expression bumped from ^2.0.0-beta.16 to ^2.0.0-beta.17
    * @rapiq/parser-simple bumped from ^2.0.0-beta.16 to ^2.0.0-beta.17

## [2.0.0-beta.16](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.15...codec-url-v2.0.0-beta.16) (2026-08-04)


### ⚠ BREAKING CHANGES

* **core:** carry filter displaceability explicitly ([#876](https://github.com/tada5hi/rapiq/issues/876))

### Features

* **core:** carry filter displaceability explicitly ([#876](https://github.com/tada5hi/rapiq/issues/876)) ([5143ef9](https://github.com/tada5hi/rapiq/commit/5143ef96bafc1211a5c3f364725bd25d5bc911e3))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.15 to ^2.0.0-beta.16
    * @rapiq/parser-expression bumped from ^2.0.0-beta.15 to ^2.0.0-beta.16
    * @rapiq/parser-simple bumped from ^2.0.0-beta.15 to ^2.0.0-beta.16
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.15 to ^2.0.0-beta.16
    * @rapiq/parser-expression bumped from ^2.0.0-beta.15 to ^2.0.0-beta.16
    * @rapiq/parser-simple bumped from ^2.0.0-beta.15 to ^2.0.0-beta.16

## [2.0.0-beta.15](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.14...codec-url-v2.0.0-beta.15) (2026-08-03)


### Miscellaneous Chores

* **codec-url:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.14 to ^2.0.0-beta.15
    * @rapiq/parser-expression bumped from ^2.0.0-beta.14 to ^2.0.0-beta.15
    * @rapiq/parser-simple bumped from ^2.0.0-beta.14 to ^2.0.0-beta.15
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.14 to ^2.0.0-beta.15
    * @rapiq/parser-expression bumped from ^2.0.0-beta.14 to ^2.0.0-beta.15
    * @rapiq/parser-simple bumped from ^2.0.0-beta.14 to ^2.0.0-beta.15

## [2.0.0-beta.14](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.13...codec-url-v2.0.0-beta.14) (2026-08-02)


### ⚠ BREAKING CHANGES

* **codec-url:** receivers matching the raw fields[__DEFAULT__] wire key must switch to fields[$root]; rapiq decoders read both.
* select the execution mode by calling parse() or parseAsync(), not via an options flag.

### Bug Fixes

* **codec-url:** spell the root field group $root on the wire ([#869](https://github.com/tada5hi/rapiq/issues/869)) ([d162c1f](https://github.com/tada5hi/rapiq/commit/d162c1fd497f6f22da8b28d712263dbea25e5ddb))


### Miscellaneous Chores

* pre-GA cleanup sweep ([#866](https://github.com/tada5hi/rapiq/issues/866)) ([f4e7b68](https://github.com/tada5hi/rapiq/commit/f4e7b68e32ebae902e1a742a09f57606c1b84f5c))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.13 to ^2.0.0-beta.14
    * @rapiq/parser-expression bumped from ^2.0.0-beta.13 to ^2.0.0-beta.14
    * @rapiq/parser-simple bumped from ^2.0.0-beta.13 to ^2.0.0-beta.14
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.13 to ^2.0.0-beta.14
    * @rapiq/parser-expression bumped from ^2.0.0-beta.13 to ^2.0.0-beta.14
    * @rapiq/parser-simple bumped from ^2.0.0-beta.13 to ^2.0.0-beta.14

## [2.0.0-beta.13](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.12...codec-url-v2.0.0-beta.13) (2026-07-28)


### ⚠ BREAKING CHANGES

* @rapiq/sql, @rapiq/typeorm, @rapiq/prisma and @rapiq/memory are now published as @rapiq/adapter-sql, @rapiq/adapter-typeorm, @rapiq/adapter-prisma and @rapiq/adapter-memory.

### Code Refactoring

* prefix backend packages with adapter- ([#858](https://github.com/tada5hi/rapiq/issues/858)) ([1f43ad4](https://github.com/tada5hi/rapiq/commit/1f43ad4b52dcea413e2004d8d17d4a09afcd2d02))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.12 to ^2.0.0-beta.13
    * @rapiq/parser-expression bumped from ^2.0.0-beta.12 to ^2.0.0-beta.13
    * @rapiq/parser-simple bumped from ^2.0.0-beta.12 to ^2.0.0-beta.13
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.12 to ^2.0.0-beta.13
    * @rapiq/parser-expression bumped from ^2.0.0-beta.12 to ^2.0.0-beta.13
    * @rapiq/parser-simple bumped from ^2.0.0-beta.12 to ^2.0.0-beta.13

## [2.0.0-beta.12](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.11...codec-url-v2.0.0-beta.12) (2026-07-28)


### Miscellaneous Chores

* **codec-url:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.11 to ^2.0.0-beta.12
    * @rapiq/parser-expression bumped from ^2.0.0-beta.11 to ^2.0.0-beta.12
    * @rapiq/parser-simple bumped from ^2.0.0-beta.11 to ^2.0.0-beta.12
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.11 to ^2.0.0-beta.12
    * @rapiq/parser-expression bumped from ^2.0.0-beta.11 to ^2.0.0-beta.12
    * @rapiq/parser-simple bumped from ^2.0.0-beta.11 to ^2.0.0-beta.12

## [2.0.0-beta.11](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.10...codec-url-v2.0.0-beta.11) (2026-07-27)


### Miscellaneous Chores

* **codec-url:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.10 to ^2.0.0-beta.11
    * @rapiq/parser-expression bumped from ^2.0.0-beta.10 to ^2.0.0-beta.11
    * @rapiq/parser-simple bumped from ^2.0.0-beta.10 to ^2.0.0-beta.11
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.10 to ^2.0.0-beta.11
    * @rapiq/parser-expression bumped from ^2.0.0-beta.10 to ^2.0.0-beta.11
    * @rapiq/parser-simple bumped from ^2.0.0-beta.10 to ^2.0.0-beta.11

## [2.0.0-beta.10](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.9...codec-url-v2.0.0-beta.10) (2026-07-26)


### Features

* condition-returning and batched key validation hooks ([#830](https://github.com/tada5hi/rapiq/issues/830)) ([#837](https://github.com/tada5hi/rapiq/issues/837)) ([ceda0b4](https://github.com/tada5hi/rapiq/commit/ceda0b4f6ef51f2ac1f68b17da1fa7f635d44532))
* **prisma:** add prisma adapter ([#838](https://github.com/tada5hi/rapiq/issues/838)) ([83c9c94](https://github.com/tada5hi/rapiq/commit/83c9c94db1d178b17798c9b106f99cdf027cfb65))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.9 to ^2.0.0-beta.10
    * @rapiq/parser-expression bumped from ^2.0.0-beta.9 to ^2.0.0-beta.10
    * @rapiq/parser-simple bumped from ^2.0.0-beta.9 to ^2.0.0-beta.10
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.9 to ^2.0.0-beta.10
    * @rapiq/parser-expression bumped from ^2.0.0-beta.9 to ^2.0.0-beta.10
    * @rapiq/parser-simple bumped from ^2.0.0-beta.9 to ^2.0.0-beta.10

## [2.0.0-beta.9](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.8...codec-url-v2.0.0-beta.9) (2026-07-24)


### Miscellaneous Chores

* **codec-url:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.8 to ^2.0.0-beta.9
    * @rapiq/parser-expression bumped from ^2.0.0-beta.8 to ^2.0.0-beta.9
    * @rapiq/parser-simple bumped from ^2.0.0-beta.8 to ^2.0.0-beta.9
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.8 to ^2.0.0-beta.9
    * @rapiq/parser-expression bumped from ^2.0.0-beta.8 to ^2.0.0-beta.9
    * @rapiq/parser-simple bumped from ^2.0.0-beta.8 to ^2.0.0-beta.9

## [2.0.0-beta.8](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.7...codec-url-v2.0.0-beta.8) (2026-07-24)


### Miscellaneous Chores

* **codec-url:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.7 to ^2.0.0-beta.8
    * @rapiq/parser-expression bumped from ^2.0.0-beta.7 to ^2.0.0-beta.8
    * @rapiq/parser-simple bumped from ^2.0.0-beta.7 to ^2.0.0-beta.8
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.7 to ^2.0.0-beta.8
    * @rapiq/parser-expression bumped from ^2.0.0-beta.7 to ^2.0.0-beta.8
    * @rapiq/parser-simple bumped from ^2.0.0-beta.7 to ^2.0.0-beta.8

## [2.0.0-beta.7](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.6...codec-url-v2.0.0-beta.7) (2026-07-22)


### Features

* **core:** authorize relation paths traversed by filters/fields/sort ([#815](https://github.com/tada5hi/rapiq/issues/815)) ([#816](https://github.com/tada5hi/rapiq/issues/816)) ([1f98ff3](https://github.com/tada5hi/rapiq/commit/1f98ff3f577eb702d1b55ee6e7b3a3a166d5c44a))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7
    * @rapiq/parser-expression bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7
    * @rapiq/parser-simple bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7
    * @rapiq/parser-expression bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7
    * @rapiq/parser-simple bumped from ^2.0.0-beta.6 to ^2.0.0-beta.7

## [2.0.0-beta.6](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.5...codec-url-v2.0.0-beta.6) (2026-07-21)


### Features

* first-class not() negation in the public condition IR ([#812](https://github.com/tada5hi/rapiq/issues/812)) ([d63e0a3](https://github.com/tada5hi/rapiq/commit/d63e0a33776e6d9ad8a8a16fde9423a6ad0ff3b5)), closes [#811](https://github.com/tada5hi/rapiq/issues/811)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6
    * @rapiq/parser-expression bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6
    * @rapiq/parser-simple bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6
    * @rapiq/parser-expression bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6
    * @rapiq/parser-simple bumped from ^2.0.0-beta.5 to ^2.0.0-beta.6

## [2.0.0-beta.5](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.4...codec-url-v2.0.0-beta.5) (2026-07-21)


### Miscellaneous Chores

* **codec-url:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5
    * @rapiq/parser-expression bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5
    * @rapiq/parser-simple bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5
    * @rapiq/parser-expression bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5
    * @rapiq/parser-simple bumped from ^2.0.0-beta.4 to ^2.0.0-beta.5

## [2.0.0-beta.4](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.3...codec-url-v2.0.0-beta.4) (2026-07-20)


### Miscellaneous Chores

* **codec-url:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4
    * @rapiq/parser-expression bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4
    * @rapiq/parser-simple bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4
    * @rapiq/parser-expression bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4
    * @rapiq/parser-simple bumped from ^2.0.0-beta.3 to ^2.0.0-beta.4

## [2.0.0-beta.3](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.2...codec-url-v2.0.0-beta.3) (2026-07-20)


### Miscellaneous Chores

* **codec-url:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3
    * @rapiq/parser-expression bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3
    * @rapiq/parser-simple bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3
    * @rapiq/parser-expression bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3
    * @rapiq/parser-simple bumped from ^2.0.0-beta.2 to ^2.0.0-beta.3

## [2.0.0-beta.2](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.1...codec-url-v2.0.0-beta.2) (2026-07-20)


### Features

* first-class parameter masking for parse and decode ([#786](https://github.com/tada5hi/rapiq/issues/786)) ([5a0c8ca](https://github.com/tada5hi/rapiq/commit/5a0c8ca7e41f282ad4594616968db3d0292889d6)), closes [#778](https://github.com/tada5hi/rapiq/issues/778)


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2
    * @rapiq/parser-expression bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2
    * @rapiq/parser-simple bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2
    * @rapiq/parser-expression bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2
    * @rapiq/parser-simple bumped from ^2.0.0-beta.1 to ^2.0.0-beta.2

## [2.0.0-beta.1](https://github.com/tada5hi/rapiq/compare/codec-url-v2.0.0-beta.0...codec-url-v2.0.0-beta.1) (2026-07-19)


### Miscellaneous Chores

* **codec-url:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1
    * @rapiq/parser-expression bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1
    * @rapiq/parser-simple bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1
    * @rapiq/parser-expression bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1
    * @rapiq/parser-simple bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1

## [2.0.0-beta.0](https://github.com/tada5hi/rapiq/compare/codec-url-v1.0.0...codec-url-v2.0.0-beta.0) (2026-07-17)


### ⚠ BREAKING CHANGES

* every elemMatch node now opens its own quantifier scope in @rapiq/memory - two elemMatches on one field (or an elemMatch beside a dotted sibling) bind independent elements (mongo semantics) instead of sharing one binding. $-prefixed keys are no longer accepted as field names in the build-layer filters object grammar. In the expression filter dialect, elemMatch is now a reserved keyword and $-prefixed words are reserved markers, so fields with these names no longer tokenize.
* **codec-url:** remove @rapiq/codec-url-simple and @rapiq/codec-url-expression as standalone packages.
* relation aliases now use length-prefixed path segments to avoid collisions.
* package rapiq renamed

### Features

* add ITSELF self-reference marker for element-level $elemMatch and $all ([#770](https://github.com/tada5hi/rapiq/issues/770)) ([e1d5c4c](https://github.com/tada5hi/rapiq/commit/e1d5c4c0f4c94bcde359aa92cc118cd773641c03))
* add missing encoder/decoder capabilities + missing tests ([#699](https://github.com/tada5hi/rapiq/issues/699)) ([9f2e69f](https://github.com/tada5hi/rapiq/commit/9f2e69f71cd5a26a0e313f62077dc229bf72463b))
* add size array-length filter operator ([#771](https://github.com/tada5hi/rapiq/issues/771)) ([013bf06](https://github.com/tada5hi/rapiq/commit/013bf06be06d1aef808f50e9a5dc922ab36f75ab))
* codec completion — round-trip subset law, expression url codec & registry ([#748](https://github.com/tada5hi/rapiq/issues/748)) ([42fc558](https://github.com/tada5hi/rapiq/commit/42fc5588975fcd5d5f82ed880b00310e64834e25))
* **codec-url:** consolidate URL codecs ([#765](https://github.com/tada5hi/rapiq/issues/765)) ([b7a7f41](https://github.com/tada5hi/rapiq/commit/b7a7f41be791324e8069ab4d800b41f329efd729))
* replace interpreter with visitor pattern ([#668](https://github.com/tada5hi/rapiq/issues/668)) ([a9c4ae5](https://github.com/tada5hi/rapiq/commit/a9c4ae5f56de8e87da22176711bbc45ef8addb24))
* split in codec-url, parser-simple & parser-expression package ([#663](https://github.com/tada5hi/rapiq/issues/663)) ([4be53ad](https://github.com/tada5hi/rapiq/commit/4be53adfa653bb31ef40a2f0fddb1b70f494f91e))


### Bug Fixes

* **deps:** bump the minorandpatch group across 1 directory with 9 updates ([#689](https://github.com/tada5hi/rapiq/issues/689)) ([bcd7721](https://github.com/tada5hi/rapiq/commit/bcd7721ab8ab8afa3b319d8e6dfaa963194412d9))
* harden v2 beta release ([#763](https://github.com/tada5hi/rapiq/issues/763)) ([51a906a](https://github.com/tada5hi/rapiq/commit/51a906aa1e5d9e8e4bd1e4dc0f9fce8ec4aaddeb))
* minor enhancement to url-codec encoder ([6640ceb](https://github.com/tada5hi/rapiq/commit/6640ceb58fc1af76cd7b9b17e2b53fd4068aa31c))


### Code Refactoring

* rename rapiq package to @rapiq/core ([#694](https://github.com/tada5hi/rapiq/issues/694)) ([89ffc31](https://github.com/tada5hi/rapiq/commit/89ffc31b8a31286213de5a890199d88fbe160313))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^1.0.0 to ^2.0.0-beta.0
    * @rapiq/parser-expression bumped from ^1.0.0 to ^2.0.0-beta.0
    * @rapiq/parser-simple bumped from ^1.0.0 to ^2.0.0-beta.0
  * peerDependencies
    * @rapiq/core bumped from ^1.0.0 to ^2.0.0-beta.0
    * @rapiq/parser-expression bumped from ^1.0.0 to ^2.0.0-beta.0
    * @rapiq/parser-simple bumped from ^1.0.0 to ^2.0.0-beta.0
