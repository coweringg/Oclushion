use crate::repository::Repository;
use crate::BlameLine;

pub struct LineBlame;

impl LineBlame {
    pub fn blame_file(repo: &Repository, path: &str) -> crate::Result<Vec<BlameLine>> {
        let workdir = repo
            .workdir()
            .ok_or_else(|| crate::Error::Message("No working directory".to_string()))?;
        let full_path = workdir.join(path);

        let content = std::fs::read_to_string(&full_path)?;

        let head = repo
            .head()
            .map_err(|e| crate::Error::Git(e.to_string()))?;
        let mut head_mut = head;
        let head_oid_str = head_mut
            .peel_to_commit()
            .map_err(|e| crate::Error::Git(e.to_string()))?
            .id()
            .to_string();

        let lines: Vec<&str> = content.lines().collect();
        let mut blame_lines = Vec::with_capacity(lines.len());

        for (i, line) in lines.iter().enumerate() {
            blame_lines.push(BlameLine {
                line_number: (i + 1) as u32,
                content: line.to_string(),
                commit_oid: head_oid_str.clone(),
                author: "Oclushion Agent".to_string(),
                timestamp: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64,
            });
        }

        Ok(blame_lines)
    }
}
