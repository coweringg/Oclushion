use aes_gcm::aead::{Aead, KeyInit, rand_core::{OsRng, RngCore}};
use aes_gcm::aead::generic_array::GenericArray;
use aes_gcm::Aes256Gcm;
use pbkdf2::pbkdf2_hmac_array;
use sha2::Sha256;
use crate::CryptoError;

const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;
const PBKDF2_ROUNDS: u32 = 100_000;

pub struct Crypto;

impl Crypto {
    pub fn encrypt(data: &[u8], password: &str) -> Result<Vec<u8>, CryptoError> {
        let mut salt = vec![0u8; SALT_LEN];
        OsRng.fill_bytes(&mut salt);

        let mut nonce_bytes = vec![0u8; NONCE_LEN];
        OsRng.fill_bytes(&mut nonce_bytes);

        let derived_key =
            pbkdf2_hmac_array::<Sha256, KEY_LEN>(password.as_bytes(), &salt, PBKDF2_ROUNDS);
        let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&derived_key);
        let cipher = Aes256Gcm::new(key);
        let nonce = GenericArray::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, data)
            .map_err(|e| CryptoError::Encrypt(e.to_string()))?;

        let mut result = Vec::with_capacity(SALT_LEN + NONCE_LEN + ciphertext.len());
        result.extend_from_slice(&salt);
        result.extend_from_slice(&nonce_bytes);
        result.extend_from_slice(&ciphertext);
        Ok(result)
    }

    pub fn decrypt(data: &[u8], password: &str) -> Result<Vec<u8>, CryptoError> {
        if data.len() < SALT_LEN + NONCE_LEN {
            return Err(CryptoError::InvalidKey);
        }

        let salt = &data[..SALT_LEN];
        let nonce_bytes = &data[SALT_LEN..SALT_LEN + NONCE_LEN];
        let ciphertext = &data[SALT_LEN + NONCE_LEN..];

        let derived_key =
            pbkdf2_hmac_array::<Sha256, KEY_LEN>(password.as_bytes(), salt, PBKDF2_ROUNDS);
        let key = aes_gcm::Key::<Aes256Gcm>::from_slice(&derived_key);
        let cipher = Aes256Gcm::new(key);
        let nonce = GenericArray::from_slice(nonce_bytes);

        let plaintext = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| CryptoError::Decrypt(e.to_string()))?;

        Ok(plaintext)
    }
}
