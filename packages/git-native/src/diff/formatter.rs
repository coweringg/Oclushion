use serde_json::{json, Value};
use crate::DiffEntry;

pub struct DiffFormatter;

impl DiffFormatter {
    pub fn format_as_unified(entries: &[DiffEntry]) -> String {
        let mut output = String::new();
        for entry in entries {
            output.push_str(&format!("--- a/{}\n", entry.file));
            output.push_str(&format!("+++ b/{}\n", entry.file));
            for hunk in &entry.hunks {
                output.push_str(&format!(
                    "@@ -{},{} +{},{} @@\n",
                    hunk.old_start, hunk.old_lines, hunk.new_start, hunk.new_lines
                ));
                output.push_str(&hunk.content);
                if !hunk.content.ends_with('\n') {
                    output.push('\n');
                }
            }
        }
        output
    }

    pub fn format_as_json(entries: &[DiffEntry]) -> Value {
        let items: Vec<Value> = entries
            .iter()
            .map(|e| {
                json!({
                    "file": e.file,
                    "added_lines": e.added_lines,
                    "removed_lines": e.removed_lines,
                    "hunks": e.hunks.iter().map(|h| {
                        json!({
                            "old_start": h.old_start,
                            "old_lines": h.old_lines,
                            "new_start": h.new_start,
                            "new_lines": h.new_lines,
                            "content": h.content,
                        })
                    }).collect::<Vec<_>>(),
                })
            })
            .collect();
        json!(items)
    }

    pub fn format_as_safediff(entries: &[DiffEntry]) -> Value {
        let mut safe = Vec::new();
        for entry in entries {
            let mut file_entry = json!({
                "file": entry.file,
                "type": if entry.added_lines > 0 && entry.removed_lines == 0 {
                    "added"
                } else if entry.removed_lines > 0 && entry.added_lines == 0 {
                    "deleted"
                } else {
                    "modified"
                },
                "changes": [],
            });
            let mut changes = Vec::new();
            for hunk in &entry.hunks {
                for line in hunk.content.lines() {
                    if line.starts_with('+') {
                        changes.push(json!({
                            "type": "addition",
                            "content": &line[1..],
                        }));
                    } else if line.starts_with('-') {
                        changes.push(json!({
                            "type": "deletion",
                            "content": &line[1..],
                        }));
                    } else if line.starts_with(' ') {
                        changes.push(json!({
                            "type": "context",
                            "content": &line[1..],
                        }));
                    }
                }
            }
            file_entry["changes"] = json!(changes);
            safe.push(file_entry);
        }
        json!(safe)
    }
}
