//! Local AES-GCM envelope for small secret JSON blobs (honest at-rest encryption).
//! Format: `cpt1:` + base64(nonce||ciphertext). Plaintext legacy files still load.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

const PREFIX: &str = "cpt1:";

fn machine_key() -> [u8; 32] {
    let mut material = String::from("cockpit-tools-local-secret-v1");
    if let Some(home) = dirs::home_dir() {
        material.push('|');
        material.push_str(&home.display().to_string());
    }
    if let Ok(user) = std::env::var("USER").or_else(|_| std::env::var("USERNAME")) {
        material.push('|');
        material.push_str(&user);
    }
    let digest = Sha256::digest(material.as_bytes());
    let mut key = [0u8; 32];
    key.copy_from_slice(&digest);
    key
}

pub fn encrypt_string(plaintext: &str) -> Result<String, String> {
    let cipher = Aes256Gcm::new_from_slice(&machine_key()).map_err(|e| e.to_string())?;
    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ct = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("encrypt failed: {e}"))?;
    let mut packed = Vec::with_capacity(12 + ct.len());
    packed.extend_from_slice(&nonce_bytes);
    packed.extend_from_slice(&ct);
    Ok(format!("{PREFIX}{}", B64.encode(packed)))
}

pub fn decrypt_string(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim();
    if !trimmed.starts_with(PREFIX) {
        // Legacy plaintext
        return Ok(trimmed.to_string());
    }
    let b64 = &trimmed[PREFIX.len()..];
    let packed = B64
        .decode(b64.as_bytes())
        .map_err(|e| format!("decode failed: {e}"))?;
    if packed.len() < 13 {
        return Err("ciphertext too short".to_string());
    }
    let (nonce_bytes, ct) = packed.split_at(12);
    let cipher = Aes256Gcm::new_from_slice(&machine_key()).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let pt = cipher
        .decrypt(nonce, ct)
        .map_err(|e| format!("decrypt failed: {e}"))?;
    String::from_utf8(pt).map_err(|e| format!("utf8 failed: {e}"))
}

pub fn read_secret_file(path: &Path) -> Result<String, String> {
    if !path.exists() {
        return Ok(String::new());
    }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    decrypt_string(&raw)
}

pub fn write_secret_file(path: &Path, plaintext_json: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let enc = encrypt_string(plaintext_json)?;
    crate::modules::atomic_write::write_string_atomic(path, &enc)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_encrypt_decrypt() {
        let msg = r#"{"hello":"world"}"#;
        let enc = encrypt_string(msg).expect("enc");
        assert!(enc.starts_with(PREFIX));
        let dec = decrypt_string(&enc).expect("dec");
        assert_eq!(dec, msg);
        assert_eq!(decrypt_string(msg).unwrap(), msg);
    }
}
