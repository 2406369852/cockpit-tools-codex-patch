use std::cmp::Reverse;
use std::collections::HashMap;

use serde_json::Value;

static LOCALES: std::sync::LazyLock<HashMap<&'static str, Value>> =
    std::sync::LazyLock::new(|| {
        let locale_files = [
            ("ar", include_str!("../../../../src/locales/ar.json")),
            ("cs", include_str!("../../../../src/locales/cs.json")),
            ("de", include_str!("../../../../src/locales/de.json")),
            ("en-us", include_str!("../../../../src/locales/en-US.json")),
            ("en", include_str!("../../../../src/locales/en.json")),
            ("es", include_str!("../../../../src/locales/es.json")),
            ("fr", include_str!("../../../../src/locales/fr.json")),
            ("it", include_str!("../../../../src/locales/it.json")),
            ("ja", include_str!("../../../../src/locales/ja.json")),
            ("ko", include_str!("../../../../src/locales/ko.json")),
            ("pl", include_str!("../../../../src/locales/pl.json")),
            ("pt-br", include_str!("../../../../src/locales/pt-br.json")),
            ("ru", include_str!("../../../../src/locales/ru.json")),
            ("tr", include_str!("../../../../src/locales/tr.json")),
            ("vi", include_str!("../../../../src/locales/vi.json")),
            ("zh-cn", include_str!("../../../../src/locales/zh-CN.json")),
            ("zh-tw", include_str!("../../../../src/locales/zh-tw.json")),
        ];

        locale_files
            .into_iter()
            .map(|(locale, content)| {
                let parsed = serde_json::from_str::<Value>(content)
                    .unwrap_or_else(|err| panic!("解析语言文件失败 {}: {}", locale, err));
                (locale, parsed)
            })
            .collect()
    });

fn normalize_locale(locale: &str) -> String {
    locale.trim().replace('_', "-").to_lowercase()
}

fn locale_candidates(locale: &str) -> Vec<String> {
    let normalized = normalize_locale(locale);
    if normalized.is_empty() {
        return vec!["en-us".to_string(), "en".to_string()];
    }

    let mut candidates = vec![normalized.clone()];

    let mut prefix_matches: Vec<&str> = LOCALES
        .keys()
        .copied()
        .filter(|known| normalized.starts_with(&format!("{}-", known)))
        .collect();
    prefix_matches.sort_by_key(|known| Reverse(known.len()));

    for known in prefix_matches {
        if normalized.starts_with(&format!("{}-", known))
            && !candidates.iter().any(|item| item == known)
        {
            candidates.push(known.to_string());
        }
    }

    if normalized == "zh" || normalized.starts_with("zh-cn-") || normalized.starts_with("zh-sg-") {
        candidates.push("zh-cn".to_string());
    }

    if normalized.starts_with("zh-tw-")
        || normalized.starts_with("zh-hk")
        || normalized.starts_with("zh-mo")
    {
        candidates.push("zh-tw".to_string());
    }

    if normalized == "pt" {
        candidates.push("pt-br".to_string());
    }

    if !candidates.iter().any(|item| item == "en-us") {
        candidates.push("en-us".to_string());
    }
    if !candidates.iter().any(|item| item == "en") {
        candidates.push("en".to_string());
    }

    candidates
}

fn lookup_key<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    let mut current = value;
    for segment in key.split('.') {
        current = current.get(segment)?;
    }
    current.as_str()
}

pub fn translate(locale: &str, key: &str, replacements: &[(&str, &str)]) -> String {
    let template = locale_candidates(locale)
        .into_iter()
        .find_map(|candidate| {
            LOCALES
                .get(candidate.as_str())
                .and_then(|value| lookup_key(value, key))
        })
        .unwrap_or(key);

    let mut output = template.to_string();
    for (name, value) in replacements {
        output = output.replace(&format!("{{{{{}}}}}", name), value);
    }
    output
}

#[cfg(test)]
mod tests {
    use super::translate;

    #[test]
    fn uses_selected_locale() {
        assert_eq!(
            translate("zh-cn", "quotaAlert.modal.title", &[]),
            "配额预警"
        );
        assert_eq!(
            translate("en-us", "quotaAlert.modal.title", &[]),
            "Quota Alert"
        );
    }

    #[test]
    fn falls_back_to_base_locale() {
        assert_eq!(
            translate("en-gb", "quotaAlert.modal.title", &[]),
            "Quota Alert"
        );
    }

    #[test]
    fn interpolates_placeholders() {
        let text = translate(
            "en-us",
            "quotaAlert.bannerText",
            &[
                ("email", "demo@example.com"),
                ("threshold", "20"),
                ("lowest", "12"),
                ("models", "claude-sonnet-4"),
            ],
        );

        assert_eq!(
            text,
            "Quota alert for demo@example.com (threshold 20%, lowest 12%, models: claude-sonnet-4)"
        );
    }
}
