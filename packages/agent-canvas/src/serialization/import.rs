use crate::serialization::export::WorkflowDocument;
use crate::serialization::schema::WorkflowSchema;
use crate::serialization::versioning;
use crate::serialization::SerializeError;

pub fn import_workflow(json: &str, target_version: u32) -> Result<WorkflowDocument, SerializeError> {
    let mut doc: WorkflowDocument = serde_json::from_str(json)
        .map_err(|e| SerializeError::InvalidSchema(format!("Failed to parse JSON: {}", e)))?;

    WorkflowSchema::validate(&doc)
        .map_err(|errors| SerializeError::ValidationError(errors.join("; ")))?;

    if doc.version != target_version {
        let ver = doc.version;
        doc = versioning::migrate(doc, ver, target_version)?;
    }

    Ok(doc)
}

pub fn import_workflow_value(value: serde_json::Value, target_version: u32) -> Result<WorkflowDocument, SerializeError> {
    let doc: WorkflowDocument = serde_json::from_value(value)
        .map_err(|e| SerializeError::InvalidSchema(format!("Failed to parse value: {}", e)))?;

    WorkflowSchema::validate(&doc)
        .map_err(|errors| SerializeError::ValidationError(errors.join("; ")))?;

    if doc.version != target_version {
        let ver = doc.version;
        return versioning::migrate(doc, ver, target_version);
    }

    Ok(doc)
}

pub fn import_workflow_unchecked(json: &str) -> Result<WorkflowDocument, SerializeError> {
    serde_json::from_str(json)
        .map_err(|e| SerializeError::InvalidSchema(format!("Failed to parse JSON: {}", e)))
}
