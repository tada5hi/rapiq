/*
 * Copyright (c) 2025.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export enum FilterRegexFlag {
    STARTS_WITH = 1 << 0,
    ENDS_WITH = 1 << 1,
    NEGATION = 1 << 2,
}

export function createFilterRegex(
    input: string,
    flag: number = 0,
): RegExp {
    const pattern = createFilterRegexPattern(input, flag);

    return new RegExp(pattern, 'i');
}

export function createFilterRegexPattern(
    input: string,
    flag: number = 0,
) : string {
    let pattern : string;
    if (flag & FilterRegexFlag.NEGATION) {
        if (
            (flag & FilterRegexFlag.STARTS_WITH) &&
            (flag & FilterRegexFlag.ENDS_WITH)
        ) {
            pattern = `^(?!.*${input}).*`;
        } else if (flag & FilterRegexFlag.STARTS_WITH) {
            pattern = `^(?!${input}).+`;
        } else {
            pattern = `^(?!.*${input}$).*`;
        }

        return pattern;
    }

    if (
        (flag & FilterRegexFlag.STARTS_WITH) &&
        (flag & FilterRegexFlag.ENDS_WITH)
    ) {
        pattern = `${input}`;
    } else if (flag & FilterRegexFlag.STARTS_WITH) {
        pattern = `^${input}`;
    } else {
        pattern = `${input}$`;
    }

    return pattern;
}
