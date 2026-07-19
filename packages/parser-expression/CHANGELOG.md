# Changelog

## [2.0.0-beta.1](https://github.com/tada5hi/rapiq/compare/parser-expression-v2.0.0-beta.0...parser-expression-v2.0.0-beta.1) (2026-07-19)


### Miscellaneous Chores

* **parser-expression:** Synchronize rapiq versions


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1
    * @rapiq/parser-simple bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1
  * peerDependencies
    * @rapiq/core bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1
    * @rapiq/parser-simple bumped from ^2.0.0-beta.0 to ^2.0.0-beta.1

## [2.0.0-beta.0](https://github.com/tada5hi/rapiq/compare/parser-expression-v1.0.0...parser-expression-v2.0.0-beta.0) (2026-07-17)


### ⚠ BREAKING CHANGES

* every elemMatch node now opens its own quantifier scope in @rapiq/memory - two elemMatches on one field (or an elemMatch beside a dotted sibling) bind independent elements (mongo semantics) instead of sharing one binding. $-prefixed keys are no longer accepted as field names in the build-layer filters object grammar. In the expression filter dialect, elemMatch is now a reserved keyword and $-prefixed words are reserved markers, so fields with these names no longer tokenize.
* the filters Validator type returns MaybeAsync<IFilter | undefined> (no void); relation aliases longer than 63 characters gain a hash suffix; TypeORM filter parameters are named rapiq_<n>_<i> instead of positional 0, 1, ...
* **codec-url:** remove @rapiq/codec-url-simple and @rapiq/codec-url-expression as standalone packages.
* relation aliases now use length-prefixed path segments to avoid collisions.
* **core:** schema defaults now apply in composite parsing even when a parameter is absent from the input; URLDecoder performs schema validation when constructed with a registry.
* **core:** the five Base*Parser classes, IInterpreter and several utils are no longer exported from @rapiq/core; sort relation failures throw SortParseError; disallowed filter/relations keys throw keyNotPermitted (ErrorCode.KEY_NOT_ALLOWED).
* package rapiq renamed

### Features

* add ITSELF self-reference marker for element-level $elemMatch and $all ([#770](https://github.com/tada5hi/rapiq/issues/770)) ([e1d5c4c](https://github.com/tada5hi/rapiq/commit/e1d5c4c0f4c94bcde359aa92cc118cd773641c03))
* add size array-length filter operator ([#771](https://github.com/tada5hi/rapiq/issues/771)) ([013bf06](https://github.com/tada5hi/rapiq/commit/013bf06be06d1aef808f50e9a5dc922ab36f75ab))
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

* **core:** correct isFilters discrimination and relation extract; add core test baseline ([#728](https://github.com/tada5hi/rapiq/issues/728)) ([4513b7d](https://github.com/tada5hi/rapiq/commit/4513b7d99a0c014e6d6322a9575ece3b5607ae86))
* harden filter validation and adapter state preservation ([#766](https://github.com/tada5hi/rapiq/issues/766)) ([97e11d4](https://github.com/tada5hi/rapiq/commit/97e11d450e8596d6a90869d30453f363add82bb9))
* harden v2 beta release ([#763](https://github.com/tada5hi/rapiq/issues/763)) ([51a906a](https://github.com/tada5hi/rapiq/commit/51a906aa1e5d9e8e4bd1e4dc0f9fce8ec4aaddeb))
* make query properties non optional ([8115b8f](https://github.com/tada5hi/rapiq/commit/8115b8f2fe4db46ed5c380f2b0179a624fe7fafb))
* make query properties readonly ([42c6ba5](https://github.com/tada5hi/rapiq/commit/42c6ba56d5baaa1091ad406d9cfd8fb3195ecb4d))
* minor enhancement to url-codec encoder ([6640ceb](https://github.com/tada5hi/rapiq/commit/6640ceb58fc1af76cd7b9b17e2b53fd4068aa31c))


### Code Refactoring

* rename rapiq package to @rapiq/core ([#694](https://github.com/tada5hi/rapiq/issues/694)) ([89ffc31](https://github.com/tada5hi/rapiq/commit/89ffc31b8a31286213de5a890199d88fbe160313))


### Dependencies

* The following workspace dependencies were updated
  * devDependencies
    * @rapiq/core bumped from ^1.0.0 to ^2.0.0-beta.0
    * @rapiq/parser-simple bumped from ^1.0.0 to ^2.0.0-beta.0
  * peerDependencies
    * @rapiq/core bumped from ^1.0.0 to ^2.0.0-beta.0
    * @rapiq/parser-simple bumped from ^1.0.0 to ^2.0.0-beta.0
