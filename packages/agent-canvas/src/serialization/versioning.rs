use crate::serialization::export::WorkflowDocument;
use crate::serialization::SerializeError;

pub const CURRENT_VERSION: u32 = 1;

pub fn migrate(doc: WorkflowDocument, from_version: u32, to_version: u32) -> Result<WorkflowDocument, SerializeError> {
    if from_version == to_version {
        return Ok(doc);
    }

    if from_version > CURRENT_VERSION {
        return Err(SerializeError::VersionMismatch {
            expected: CURRENT_VERSION,
            found: from_version,
        });
    }

    if to_version > CURRENT_VERSION {
        return Err(SerializeError::VersionMismatch {
            expected: CURRENT_VERSION,
            found: to_version,
        });
    }

    if from_version > to_version {
        return downgrade(doc, from_version, to_version);
    }

    upgrade(doc, from_version, to_version)
}

fn upgrade(mut doc: WorkflowDocument, from: u32, to: u32) -> Result<WorkflowDocument, SerializeError> {
    let mut current = from;

    while current < to {
        match current {
            0 => {
                doc = upgrade_v0_to_v1(doc)?;
            }
            _ => {
                return Err(SerializeError::MigrationFailed {
                    from,
                    to,
                    reason: format!("No migration path from version {}", current),
                });
            }
        }
        current += 1;
    }

    Ok(doc)
}

fn downgrade(mut doc: WorkflowDocument, from: u32, to: u32) -> Result<WorkflowDocument, SerializeError> {
    let mut current = from;

    while current > to {
        match current {
            1 => {
                doc = downgrade_v1_to_v0(doc)?;
            }
            _ => {
                return Err(SerializeError::MigrationFailed {
                    from,
                    to,
                    reason: format!("No downgrade path from version {}", current),
                });
            }
        }
        current -= 1;
    }

    Ok(doc)
}

fn upgrade_v0_to_v1(doc: WorkflowDocument) -> Result<WorkflowDocument, SerializeError> {
    let mut doc = doc;
    doc.version = 1;
    if doc.metadata.version.is_empty() {
        doc.metadata.version = "1.0.0".to_string();
    }
    Ok(doc)
}

fn downgrade_v1_to_v0(doc: WorkflowDocument) -> Result<WorkflowDocument, SerializeError> {
    let mut doc = doc;
    doc.version = 0;
    Ok(doc)
}

pub fn check_version(document: &WorkflowDocument) -> Result<(), SerializeError> {
    if document.version == 0 {
        return Err(SerializeError::InvalidSchema("Version 0 is not valid for import".into()));
    }
    if document.version > CURRENT_VERSION {
        return Err(SerializeError::VersionMismatch {
            expected: CURRENT_VERSION,
            found: document.version,
        });
    }
    Ok(())
}
