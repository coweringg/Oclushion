use crate::{EvidenceFile, EvidenceKind, QaResult};
use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

pub struct EvidenceManager {
    base_dir: PathBuf,
}

impl EvidenceManager {
    pub fn new(base_dir: PathBuf) -> Self {
        fs::create_dir_all(&base_dir).ok();
        Self { base_dir }
    }

    fn ensure_test_dir(&self, test_id: &str) -> PathBuf {
        let dir = self.base_dir.join(test_id);
        fs::create_dir_all(&dir).ok();
        dir
    }

    fn hash_content(data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        format!("{:x}", hasher.finalize())
    }

    pub fn store_screenshot(&self, data: &[u8], test_id: &str, step: u32) -> PathBuf {
        let dir = self.ensure_test_dir(test_id);
        let hash = Self::hash_content(data);
        let path = dir.join(format!("screenshot_step{step}_{hash}.png"));
        fs::write(&path, data).ok();
        path
    }

    pub fn store_trace(&self, data: &[u8], test_id: &str) -> PathBuf {
        let dir = self.ensure_test_dir(test_id);
        let hash = Self::hash_content(data);
        let path = dir.join(format!("trace_{hash}.zip"));
        fs::write(&path, data).ok();
        path
    }

    pub fn store_video(&self, data: &[u8], test_id: &str) -> PathBuf {
        let dir = self.ensure_test_dir(test_id);
        let hash = Self::hash_content(data);
        let path = dir.join(format!("video_{hash}.webm"));
        fs::write(&path, data).ok();
        path
    }

    pub fn store_console_log(&self, log: &str, test_id: &str) -> PathBuf {
        let dir = self.ensure_test_dir(test_id);
        let path = dir.join("console_log.txt");
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .unwrap();
        writeln!(file, "{log}").ok();
        path
    }

    pub fn store_dom_snapshot(&self, html: &str, test_id: &str, step: u32) -> PathBuf {
        let dir = self.ensure_test_dir(test_id);
        let path = dir.join(format!("dom_step{step}.html"));
        fs::write(&path, html).ok();
        path
    }

    pub fn get_test_evidence(&self, test_id: &str) -> Vec<EvidenceFile> {
        let dir = self.base_dir.join(test_id);
        if !dir.is_dir() {
            return vec![];
        }

        let mut evidence = Vec::new();
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let kind = self.classify_file(&path);
                    let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                    evidence.push(EvidenceFile {
                        path: path.to_string_lossy().to_string(),
                        kind,
                        size_bytes: size,
                    });
                }
            }
        }
        evidence
    }

    fn classify_file(&self, path: &Path) -> EvidenceKind {
        let name = path.file_name().unwrap_or_default().to_string_lossy();
        if name.contains("screenshot") || name.ends_with(".png") {
            EvidenceKind::Screenshot
        } else if name.contains("trace") || name.ends_with(".zip") {
            EvidenceKind::Trace
        } else if name.contains("video") || name.ends_with(".webm") {
            EvidenceKind::Video
        } else if name.contains("console") || name.ends_with(".txt") {
            EvidenceKind::ConsoleLog
        } else if name.contains("dom") || name.ends_with(".html") {
            EvidenceKind::DomSnapshot
        } else {
            EvidenceKind::Screenshot
        }
    }

    pub fn cleanup_old_evidence(&self, max_age_days: u64) -> u64 {
        let cutoff = chrono::offset::Utc::now()
            - chrono::Duration::days(max_age_days as i64);

        let mut deleted = 0u64;
        if let Ok(entries) = fs::read_dir(&self.base_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    if let Ok(metadata) = fs::metadata(&path) {
                        if let Ok(modified) = metadata.modified() {
                            let datetime: DateTime<Utc> = modified.into();
                            if datetime < cutoff {
                                if fs::remove_dir_all(&path).is_ok() {
                                    deleted += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
        deleted
    }

    pub fn get_disk_usage(&self) -> u64 {
        Self::dir_size(&self.base_dir)
    }

    fn dir_size(path: &Path) -> u64 {
        let mut total = 0u64;
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    total += fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                } else if path.is_dir() {
                    total += Self::dir_size(&path);
                }
            }
        }
        total
    }

    pub fn compress_evidence(&self, test_id: &str) -> QaResult<PathBuf> {
        let dir = self.base_dir.join(test_id);
        if !dir.is_dir() {
            return Err(crate::QaError::InvalidArgument(format!(
                "No evidence for test {test_id}"
            )));
        }

        let zip_path = self.base_dir.join(format!("{test_id}.zip"));
        let file = fs::File::create(&zip_path)?;
        let mut zip = zip::ZipWriter::new(file);
        let options = zip::write::FileOptions::<'_, ()>::default()
            .compression_method(zip::CompressionMethod::Deflated);

        Self::add_dir_to_zip(&mut zip, &dir, test_id, &options)?;
        zip.finish()?;

        Ok(zip_path)
    }

    fn add_dir_to_zip(
        zip: &mut zip::ZipWriter<fs::File>,
        dir: &Path,
        prefix: &str,
        options: &zip::write::FileOptions<'_, ()>,
    ) -> QaResult<()> {
        if let Ok(entries) = fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let name = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let zip_name = format!("{prefix}/{name}");
                if path.is_file() {
                    zip.start_file(&zip_name, *options)?;
                    let mut buf = Vec::new();
                    fs::File::open(&path)?.read_to_end(&mut buf)?;
                    zip.write_all(&buf)?;
                } else if path.is_dir() {
                    let new_prefix = format!("{prefix}/{name}");
                    Self::add_dir_to_zip(zip, &path, &new_prefix, options)?;
                }
            }
        }
        Ok(())
    }
}
