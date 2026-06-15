use hive_memory::sync::encryption::Crypto;

#[test]
fn test_encrypt_decrypt_roundtrip() {
    let data = b"hello world this is sensitive data";
    let password = "my-secret-password";

    let encrypted = Crypto::encrypt(data, password).unwrap();
    assert_ne!(encrypted, data);

    let decrypted = Crypto::decrypt(&encrypted, password).unwrap();
    assert_eq!(decrypted, data);
}

#[test]
fn test_encrypt_empty_data() {
    let data = b"";
    let password = "password";

    let encrypted = Crypto::encrypt(data, password).unwrap();
    let decrypted = Crypto::decrypt(&encrypted, password).unwrap();
    assert_eq!(decrypted, data);
}

#[test]
fn test_encrypt_wrong_password() {
    let data = b"secret data";
    let encrypted = Crypto::encrypt(data, "correct-password").unwrap();
    let result = Crypto::decrypt(&encrypted, "wrong-password");
    assert!(result.is_err());
}

#[test]
fn test_encrypt_different_ciphertexts() {
    let data = b"same data";
    let enc1 = Crypto::encrypt(data, "password").unwrap();
    let enc2 = Crypto::encrypt(data, "password").unwrap();
    assert_ne!(enc1, enc2);
}

#[test]
fn test_encrypt_long_data() {
    let data = vec![0x42u8; 10000];
    let password = "strong-password";

    let encrypted = Crypto::encrypt(&data, password).unwrap();
    let decrypted = Crypto::decrypt(&encrypted, password).unwrap();
    assert_eq!(decrypted, data);
}

#[test]
fn test_encrypt_invalid_data() {
    let result = Crypto::decrypt(&[0u8; 5], "password");
    assert!(result.is_err());
}

#[test]
fn test_encrypt_unicode_password() {
    let data = b"some data";
    let password = "passw\u{f6}rd_with_unicode";

    let encrypted = Crypto::encrypt(data, password).unwrap();
    let decrypted = Crypto::decrypt(&encrypted, password).unwrap();
    assert_eq!(decrypted, data);
}
