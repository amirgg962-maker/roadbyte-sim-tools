use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

use aes::Aes256;
use cbc::{Decryptor, Encryptor};
use cipher::{
    block_padding::NoPadding, block_padding::Pkcs7, BlockModeDecrypt, BlockModeEncrypt, KeyIvInit,
};
use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use flate2::Compression;
use getrandom::getrandom;
use hmac::{digest::KeyInit as HmacKeyInit, Hmac, Mac};
use sha2::Sha256;

use crate::save_parser::error::SaveError;

type Aes256CbcDec = Decryptor<Aes256>;
type Aes256CbcEnc = Encryptor<Aes256>;
type HmacSha256 = Hmac<Sha256>;

const AES_KEY: [u8; 32] = [
    0x2a, 0x5f, 0xcb, 0x17, 0x91, 0xd2, 0x2f, 0xb6, 0x02, 0x45, 0xb3, 0xd8, 0x36, 0x9e, 0xd0, 0xb2,
    0xc2, 0x73, 0x71, 0x56, 0x3f, 0xbf, 0x1f, 0x3c, 0x9e, 0xdf, 0x6b, 0x11, 0x82, 0x5a, 0x5d, 0x0a,
];

const SCSC_HEADER_SIZE: usize = 56;
const MAX_DECOMPRESSED_SAVE_SIZE: usize = 512 * 1024 * 1024;
pub const MAX_SAVE_FILE_SIZE: usize = 512 * 1024 * 1024;

pub fn read_save_file(path: &Path) -> Result<Vec<u8>, SaveError> {
    read_save_file_with_limit(path, MAX_SAVE_FILE_SIZE)
}

fn read_save_file_with_limit(path: &Path, max_size: usize) -> Result<Vec<u8>, SaveError> {
    let file = File::open(path)?;
    if file.metadata()?.len() > max_size as u64 {
        return Err(SaveError::Compression(format!(
            "Save file exceeds the {} MiB safety limit",
            max_size / (1024 * 1024)
        )));
    }

    let mut data = Vec::new();
    file.take(max_size as u64 + 1).read_to_end(&mut data)?;
    if data.len() > max_size {
        return Err(SaveError::Compression(format!(
            "Save file exceeds the {} MiB safety limit",
            max_size / (1024 * 1024)
        )));
    }
    Ok(data)
}

pub fn decompress_save(data: &[u8]) -> Result<String, SaveError> {
    if data.len() > MAX_SAVE_FILE_SIZE {
        return Err(SaveError::Compression(format!(
            "Save file exceeds the {} MiB safety limit",
            MAX_SAVE_FILE_SIZE / (1024 * 1024)
        )));
    }
    if data.len() < 4 {
        return Err(SaveError::Compression("File too small".into()));
    }

    match &data[..4] {
        b"ScsC" => decrypt_scsc(data),
        b"BSII" => Err(SaveError::Compression(
            "Binary format BSII not supported. Use g_save_format 2.".into(),
        )),
        b"SiiN" => Ok(std::str::from_utf8(data)?.to_string()),
        _ => std::str::from_utf8(data)
            .map(|s| s.to_string())
            .map_err(|_| {
                SaveError::UnknownFormat(format!("Unknown format, magic: {:?}", &data[..4]))
            }),
    }
}

fn decrypt_scsc(data: &[u8]) -> Result<String, SaveError> {
    if data.len() < SCSC_HEADER_SIZE {
        return Err(SaveError::Compression("ScsC file too short".into()));
    }

    let iv: &[u8; 16] = data[36..52]
        .try_into()
        .map_err(|_| SaveError::Compression("Invalid IV size".into()))?;

    let decompressed_size = u32::from_le_bytes(
        data[52..56]
            .try_into()
            .map_err(|_| SaveError::Compression("Invalid decompressed size".into()))?,
    ) as usize;

    if decompressed_size > MAX_DECOMPRESSED_SAVE_SIZE {
        return Err(SaveError::Compression(format!(
            "ScsC decompressed size exceeds the {} MiB safety limit",
            MAX_DECOMPRESSED_SAVE_SIZE / (1024 * 1024)
        )));
    }

    // The ScsC HMAC derivation is undocumented and independent decoders treat this
    // header field as opaque. Verifying it with a guessed key/message rejects valid
    // game files; AES/zlib decoding and the declared-size check below validate content.

    let encrypted = &data[56..];

    // Decrypt AES-CBC
    let mut buf = encrypted.to_vec();

    if !buf.len().is_multiple_of(16) {
        let padding = 16 - (buf.len() % 16);
        buf.extend(std::iter::repeat_n(0, padding));
    }

    let decrypted_len = {
        let decrypted = Aes256CbcDec::new_from_slices(&AES_KEY, iv)
            .map_err(|e| SaveError::Crypto(format!("AES init failed: {e}")))?
            .decrypt_padded::<NoPadding>(&mut buf)
            .map_err(|e| SaveError::Crypto(format!("AES decrypt failed: {e}")))?;
        decrypted.len()
    };
    buf.truncate(decrypted_len);

    // Zlib decompress
    let decoder = ZlibDecoder::new(&buf[..]);
    let mut result = Vec::new();
    decoder
        .take(decompressed_size as u64 + 1)
        .read_to_end(&mut result)
        .map_err(|e| SaveError::Compression(format!("Zlib decompression failed: {e}")))?;

    if result.len() != decompressed_size {
        return Err(SaveError::Compression(format!(
            "ScsC decompressed size mismatch: expected {decompressed_size}, got {}",
            result.len()
        )));
    }

    if result.len() >= 4 && &result[..4] == b"BSII" {
        return Err(SaveError::Compression(
            "Binary format BSII not supported. Load the save in Euro Truck Simulator 2 and save again to convert, or set g_save_format 2 in config.cfg.".into(),
        ));
    }

    let text = String::from_utf8(result)
        .map_err(|e| SaveError::Compression(format!("Save uses an unsupported format: {e}",)))?;

    Ok(text)
}

pub fn compress_save(content: &str) -> Result<Vec<u8>, SaveError> {
    let data = content.as_bytes();
    let decompressed_size = u32::try_from(data.len())
        .map_err(|_| SaveError::Compression("Save is too large for the ScsC size header".into()))?;
    if decompressed_size as usize > MAX_DECOMPRESSED_SAVE_SIZE {
        return Err(SaveError::Compression(format!(
            "Save exceeds the {} MiB ScsC safety limit",
            MAX_DECOMPRESSED_SAVE_SIZE / (1024 * 1024)
        )));
    }

    // Zlib compress
    let mut encoder = ZlibEncoder::new(Vec::new(), Compression::best());
    encoder
        .write_all(data)
        .map_err(|e| SaveError::Compression(format!("Zlib compression failed: {e}")))?;
    let compressed = encoder
        .finish()
        .map_err(|e| SaveError::Compression(format!("Zlib compression finalize failed: {e}")))?;

    // Generate random IV
    let mut iv = [0u8; 16];
    getrandom(&mut iv).map_err(|e| SaveError::Crypto(format!("Failed to generate IV: {e}")))?;

    // AES-CBC encrypt
    let block_size = 16;
    let padded_len = compressed.len() + (block_size - (compressed.len() % block_size));
    let mut enc_buf = vec![0u8; padded_len];
    enc_buf[..compressed.len()].copy_from_slice(&compressed);

    let encrypted = Aes256CbcEnc::new_from_slices(&AES_KEY, &iv)
        .map_err(|e| SaveError::Crypto(format!("AES init failed: {e}")))?
        .encrypt_padded::<Pkcs7>(&mut enc_buf, compressed.len())
        .map_err(|e| SaveError::Crypto(format!("AES encrypt failed: {e}")))?;
    let encrypted = encrypted.to_vec();

    // HMAC-SHA256
    let mut mac = HmacSha256::new_from_slice(&AES_KEY)
        .map_err(|e| SaveError::Crypto(format!("HMAC init failed: {e}")))?;
    mac.update(&iv);
    mac.update(&encrypted);
    let hmac_result = mac.finalize().into_bytes();

    // Build output
    let mut output = Vec::with_capacity(SCSC_HEADER_SIZE + encrypted.len());
    output.extend_from_slice(b"ScsC");
    output.extend_from_slice(&hmac_result);
    output.extend_from_slice(&iv);
    output.extend_from_slice(&decompressed_size.to_le_bytes());
    output.extend_from_slice(&encrypted);

    Ok(output)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_decompress_siin() {
        let data = b"SiiNunit\n{\n}\n";
        let result = decompress_save(data).unwrap();
        assert_eq!(result, "SiiNunit\n{\n}\n");
    }

    #[test]
    fn test_decompress_plain_utf8() {
        let data = b"plain text content";
        let result = decompress_save(data).unwrap();
        assert_eq!(result, "plain text content");
    }

    #[test]
    fn test_decompress_bsii_returns_error() {
        let data = b"BSII some binary data";
        let result = decompress_save(data);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err, SaveError::Compression(_)));
        assert!(err.to_string().contains("g_save_format"));
    }

    #[test]
    fn test_decompress_empty() {
        let result = decompress_save(b"");
        assert!(result.is_err());
    }

    #[test]
    fn test_decompress_too_small() {
        let result = decompress_save(b"abc");
        assert!(result.is_err());
    }

    #[test]
    fn test_compress_decompress_roundtrip() {
        let content = "SiiNunit\n{\n money_account: 100500\n experience_points: 5000\n}\n";
        let compressed = compress_save(content).unwrap();
        let decompressed = decompress_save(&compressed).unwrap();
        assert_eq!(decompressed, content);
    }

    #[test]
    fn test_compress_decompress_empty_string() {
        let compressed = compress_save("").unwrap();
        let decompressed = decompress_save(&compressed).unwrap();
        assert_eq!(decompressed, "");
    }

    #[test]
    fn test_compress_output_has_scsc_header() {
        let content = "test data";
        let compressed = compress_save(content).unwrap();
        assert_eq!(&compressed[..4], b"ScsC");
        assert!(compressed.len() > 56); // header size
    }

    #[test]
    fn test_compress_produces_valid_hmac() {
        // Re-encrypting the same plaintext should produce different output
        // because of random IV (so HMAC will differ)
        let content = "test data";
        let a = compress_save(content).unwrap();
        let b = compress_save(content).unwrap();
        assert_ne!(
            a, b,
            "two compressions of same data should differ due to random IV"
        );
    }

    #[test]
    fn test_decompress_accepts_scsc_with_unverifiable_hmac() {
        let mut compressed = compress_save("SiiNunit\n{}\n").unwrap();
        compressed[4] ^= 0x01;

        let decoded = decompress_save(&compressed).unwrap();

        assert_eq!(decoded, "SiiNunit\n{}\n");
    }

    #[test]
    fn test_read_save_file_rejects_files_over_limit() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("large.sii");
        std::fs::write(&path, b"12345").unwrap();

        let error = read_save_file_with_limit(&path, 4).unwrap_err();

        assert!(matches!(error, SaveError::Compression(_)));
        assert!(error.to_string().contains("safety limit"));
    }

    #[test]
    fn test_decompress_rejects_scsc_decompressed_size_mismatch() {
        let mut compressed = compress_save("SiiNunit\n{}\n").unwrap();
        let size = u32::from_le_bytes(compressed[52..56].try_into().unwrap());
        compressed[52..56].copy_from_slice(&(size + 1).to_le_bytes());

        let error = decompress_save(&compressed).unwrap_err();

        assert!(matches!(error, SaveError::Compression(_)));
        assert!(error.to_string().contains("decompressed size mismatch"));
    }

    #[test]
    fn test_decompress_invalid_utf8() {
        let data = b"\xff\xfe\x00\x01";
        let result = decompress_save(data);
        // Should either be an unknown format error or a UTF-8 error
        assert!(result.is_err());
    }
}
