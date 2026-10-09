//! JavaScript number semantics the wire grammar depends on.
//!
//! The TypeScript implementation leans on `String.prototype.trim`,
//! `Number(string)` and `Number.prototype.toString`. Rust's standard
//! counterparts differ in small but observable ways (`f64::from_str`
//! accepts `inf`/`nan`, `char::is_whitespace` includes U+0085 but not
//! U+FEFF), so the ECMAScript algorithms are reproduced here.

use serde_json::{Number, Value};

/// ECMAScript `WhiteSpace` and `LineTerminator` code points: the set
/// `String.prototype.trim` strips and the `\s` regex class matches.
pub fn is_js_whitespace(c: char) -> bool {
    matches!(
        c,
        '\u{0009}'
            | '\u{000A}'
            | '\u{000B}'
            | '\u{000C}'
            | '\u{000D}'
            | '\u{0020}'
            | '\u{00A0}'
            | '\u{1680}'
            | '\u{2000}'
            ..='\u{200A}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202F}'
                | '\u{205F}'
                | '\u{3000}'
                | '\u{FEFF}'
    )
}

/// `String.prototype.trim`.
pub fn js_trim(input: &str) -> &str {
    input.trim_matches(is_js_whitespace)
}

/// `Number(string)` (ECMAScript `StringToNumber`). Returns `NaN` for
/// input outside the `StringNumericLiteral` grammar.
pub fn js_string_to_number(input: &str) -> f64 {
    let s = js_trim(input);
    if s.is_empty() {
        return 0.0;
    }

    match s {
        "Infinity" | "+Infinity" => return f64::INFINITY,
        "-Infinity" => return f64::NEG_INFINITY,
        _ => {}
    }

    let bytes = s.as_bytes();
    if bytes.len() > 2 && bytes[0] == b'0' {
        let radix = match bytes[1] {
            b'x' | b'X' => Some(16),
            b'o' | b'O' => Some(8),
            b'b' | b'B' => Some(2),
            _ => None,
        };

        if let Some(radix) = radix {
            return parse_radix(&s[2..], radix);
        }
    }

    if !is_decimal_literal(bytes) {
        return f64::NAN;
    }

    s.parse::<f64>().unwrap_or(f64::NAN)
}

fn parse_radix(digits: &str, radix: u32) -> f64 {
    if digits.is_empty() {
        return f64::NAN;
    }

    let mut wide: u128 = 0;
    let mut overflow = false;
    let mut approx: f64 = 0.0;

    for c in digits.chars() {
        let Some(d) = c.to_digit(radix) else {
            return f64::NAN;
        };

        approx = approx * f64::from(radix) + f64::from(d);
        if !overflow {
            match wide
                .checked_mul(u128::from(radix))
                .and_then(|v| v.checked_add(u128::from(d)))
            {
                Some(v) => wide = v,
                None => overflow = true,
            }
        }
    }

    if overflow { approx } else { wide as f64 }
}

/// `[+-]? (digits ('.' digits?)? | '.' digits) ([eE] [+-]? digits)?`
fn is_decimal_literal(bytes: &[u8]) -> bool {
    let mut i = 0;
    if i < bytes.len() && (bytes[i] == b'+' || bytes[i] == b'-') {
        i += 1;
    }

    let int_start = i;
    while i < bytes.len() && bytes[i].is_ascii_digit() {
        i += 1;
    }
    let int_digits = i - int_start;

    let mut frac_digits = 0;
    if i < bytes.len() && bytes[i] == b'.' {
        i += 1;
        let frac_start = i;
        while i < bytes.len() && bytes[i].is_ascii_digit() {
            i += 1;
        }
        frac_digits = i - frac_start;
    }

    if int_digits == 0 && frac_digits == 0 {
        return false;
    }

    if i < bytes.len() && (bytes[i] == b'e' || bytes[i] == b'E') {
        i += 1;
        if i < bytes.len() && (bytes[i] == b'+' || bytes[i] == b'-') {
            i += 1;
        }
        let exp_start = i;
        while i < bytes.len() && bytes[i].is_ascii_digit() {
            i += 1;
        }
        if i == exp_start {
            return false;
        }
    }

    i == bytes.len()
}

/// `Number.prototype.toString()` (shortest round-trip form, ECMAScript
/// exponent rules).
pub fn js_number_to_string(value: f64) -> String {
    let mut buffer = ryu_js::Buffer::new();
    buffer.format(value).to_string()
}

const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

/// A JSON number for an f64, written the way `JSON.stringify` writes
/// it: integral values without a fraction, `-0` as `0`. Non-finite
/// values have no JSON form (`JSON.stringify` writes `null`), so
/// `None` is returned for them.
pub fn json_number(value: f64) -> Option<Value> {
    if !value.is_finite() {
        return None;
    }

    if value.fract() == 0.0 && value.abs() <= MAX_SAFE_INTEGER {
        return Some(Value::Number(Number::from(value as i64)));
    }

    Number::from_f64(value).map(Value::Number)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn string_to_number_follows_ecmascript() {
        assert_eq!(js_string_to_number("18"), 18.0);
        assert_eq!(js_string_to_number(" 1.5 "), 1.5);
        assert_eq!(js_string_to_number(".5"), 0.5);
        assert_eq!(js_string_to_number("5."), 5.0);
        assert_eq!(js_string_to_number("1e3"), 1000.0);
        assert_eq!(js_string_to_number("0x1F"), 31.0);
        assert_eq!(js_string_to_number("0b101"), 5.0);
        assert_eq!(js_string_to_number("0o17"), 15.0);
        assert_eq!(js_string_to_number("-Infinity"), f64::NEG_INFINITY);
        assert!(js_string_to_number("inf").is_nan());
        assert!(js_string_to_number("nan").is_nan());
        assert!(js_string_to_number("-0x1").is_nan());
        assert!(js_string_to_number("1_000").is_nan());
        assert!(js_string_to_number("abc").is_nan());
        assert!(js_string_to_number(".").is_nan());
        assert!(js_string_to_number("1e").is_nan());
    }

    #[test]
    fn trim_matches_string_prototype_trim() {
        assert_eq!(js_trim("\u{FEFF} a \u{3000}"), "a");
        assert_eq!(js_trim("\u{0085}a"), "\u{0085}a");
    }

    #[test]
    fn number_to_string_matches_ecmascript() {
        assert_eq!(js_number_to_string(18.0), "18");
        assert_eq!(js_number_to_string(1.5), "1.5");
        assert_eq!(js_number_to_string(1e21), "1e+21");
        assert_eq!(js_number_to_string(1e-7), "1e-7");
        assert_eq!(js_number_to_string(-0.0), "0");
    }
}
