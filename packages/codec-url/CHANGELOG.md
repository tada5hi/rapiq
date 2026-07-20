# Changelog

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
