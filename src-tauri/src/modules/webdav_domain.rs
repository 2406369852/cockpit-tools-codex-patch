//! WebDAV domain allowlist helpers (#1104 vertical slice).

/// Parse comma-separated allowed domains (lowercase, no empty).
/// Rejects bare public-suffix-like tokens without a dot (e.g. `com`) to avoid
/// overly broad `ends_with(".{entry}")` matches.
pub fn parse_allowed_domains(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|s| s.trim().to_ascii_lowercase())
        .filter(|s| !s.is_empty())
        .filter(|s| s.contains('.') && s.len() >= 4)
        .collect()
}

/// Extract host from a URL-like string (with or without scheme).
pub fn host_from_url(url: &str) -> Option<String> {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return None;
    }
    let without_scheme = trimmed
        .split("://")
        .nth(1)
        .unwrap_or(trimmed)
        .split('/')
        .next()
        .unwrap_or("")
        .trim();
    if without_scheme.is_empty() {
        return None;
    }
    // strip userinfo and port
    let hostport = without_scheme.rsplit('@').next().unwrap_or(without_scheme);
    let host = if hostport.starts_with('[') {
        hostport
            .trim_start_matches('[')
            .split(']')
            .next()
            .unwrap_or(hostport)
            .to_ascii_lowercase()
    } else {
        hostport
            .split(':')
            .next()
            .unwrap_or(hostport)
            .to_ascii_lowercase()
    };
    if host.is_empty() {
        None
    } else {
        Some(host)
    }
}

/// Empty allowlist = allow all; otherwise host must equal or be subdomain of an entry.
pub fn host_allowed(host: &str, allowlist: &[String]) -> bool {
    if allowlist.is_empty() {
        return true;
    }
    let host = host.trim().to_ascii_lowercase();
    allowlist
        .iter()
        .any(|entry| host == *entry || host.ends_with(&format!(".{entry}")))
}

pub fn validate_webdav_url(url: &str, allowlist_raw: &str) -> Result<(), String> {
    let allowlist = parse_allowed_domains(allowlist_raw);
    if allowlist.is_empty() {
        return Ok(());
    }
    let host = host_from_url(url).ok_or_else(|| "WebDAV URL 缺少有效主机名".to_string())?;
    if host_allowed(&host, &allowlist) {
        Ok(())
    } else {
        Err(format!(
            "WebDAV 主机 {host} 不在允许域名列表中: {}",
            allowlist.join(", ")
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_hosts_and_allowlist() {
        assert_eq!(
            host_from_url("https://dav.example.com:443/path").as_deref(),
            Some("dav.example.com")
        );
        assert_eq!(
            parse_allowed_domains(" Example.COM , foo.io "),
            vec!["example.com".to_string(), "foo.io".to_string()]
        );
        assert!(host_allowed("dav.example.com", &["example.com".into()]));
        assert!(!host_allowed("evil.com", &["example.com".into()]));
        assert!(validate_webdav_url("https://a.example.com/x", "example.com").is_ok());
        assert!(validate_webdav_url("https://evil.com/x", "example.com").is_err());
        // Bare TLD-like tokens are dropped so they cannot over-match.
        assert_eq!(
            parse_allowed_domains("com, example.com"),
            vec!["example.com".to_string()]
        );
        // After filtering bare `com`, allowlist is empty → allow all (same as unset).
        assert!(host_allowed("evil.com", &parse_allowed_domains("com")));
        // With a real entry, evil.com still rejected.
        assert!(!host_allowed(
            "evil.com",
            &parse_allowed_domains("example.com")
        ));
    }
}
