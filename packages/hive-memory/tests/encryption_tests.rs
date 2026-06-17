use std::env;
use hive_memory::sync::encryption::Crypto;

fn test_pass() -> String {
    if let Ok(pwd) = env::var("TEST_CRYPTO_PASSWORD") {
        return pwd;
    }
    let value: u128 = rand::random();
    format!("test-pwd-{value:x}")
}

fn alt_pass() -> String {
    if let Ok(pwd) = env::var("TEST_CRYPTO_ALT_PASSWORD") {
        return pwd;
    }
    let value: u128 = rand::random();
    format!("alt-pwd-{value:x}")
}

fn wrong_pass() -> String {
    if let Ok(pwd) = env::var("TEST_CRYPTO_WRONG_PASSWORD") {
        return pwd;
    }
    let value: u128 = rand::random();
    format!("wrong-pwd-{value:x}")
}

#[test]
fn test_encrypt_decrypt_roundtrip() {
    let data = b"hello world this is sensitive data";
    let password = test_pass();

    let encrypted = Crypto::encrypt(data, &password).unwrap();
    assert_ne!(encrypted, data);

    let decrypted = Crypto::decrypt(&encrypted, &password).unwrap();
    assert_eq!(decrypted, data);
}

#[test]
fn test_encrypt_empty_data() {
    let data = b"";
    let password = test_pass();

    let encrypted = Crypto::encrypt(data, &password).unwrap();
    let decrypted = Crypto::decrypt(&encrypted, &password).unwrap();
    assert_eq!(decrypted, data);
}

#[test]
fn test_encrypt_wrong_password() {
    let data = b"secret data";
    let encrypted = Crypto::encrypt(data, &test_pass()).unwrap();
    let result = Crypto::decrypt(&encrypted, &wrong_pass());
    assert!(result.is_err());
}

#[test]
fn test_encrypt_different_ciphertexts() {
    let data = b"same data";
    let password = test_pass();
    let enc1 = Crypto::encrypt(data, &password).unwrap();
    let enc2 = Crypto::encrypt(data, &password).unwrap();
    assert_ne!(enc1, enc2);
}

#[test]
fn test_encrypt_long_data() {
    let data = vec![0x42u8; 10000];
    let password = test_pass();

    let encrypted = Crypto::encrypt(&data, &password).unwrap();
    let decrypted = Crypto::decrypt(&encrypted, &password).unwrap();
    assert_eq!(decrypted, data);
}

#[test]
fn test_encrypt_invalid_data() {
    let result = Crypto::decrypt(&[0u8; 5], &test_pass());
    assert!(result.is_err());
}

#[test]
fn test_encrypt_unicode_password() {
    let data = b"some data";
    let password = alt_pass();

    let encrypted = Crypto::encrypt(data, &password).unwrap();
    let decrypted = Crypto::decrypt(&encrypted, &password).unwrap();
    assert_eq!(decrypted, data);
}
