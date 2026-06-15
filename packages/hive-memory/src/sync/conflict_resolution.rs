use crate::Insight;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ConflictResolution {
    LastWriteWins,
    HighestConfidenceWins,
    KeepBoth,
}

pub struct ConflictResolver;

impl ConflictResolver {
    pub fn resolve(
        existing: &Insight,
        incoming: &Insight,
        strategy: ConflictResolution,
    ) -> Insight {
        match strategy {
            ConflictResolution::LastWriteWins => {
                if incoming.created_at > existing.created_at {
                    incoming.clone()
                } else {
                    existing.clone()
                }
            }
            ConflictResolution::HighestConfidenceWins => {
                if incoming.confidence > existing.confidence {
                    incoming.clone()
                } else {
                    existing.clone()
                }
            }
            ConflictResolution::KeepBoth => {
                let mut merged = existing.clone();
                for tag in &incoming.tags {
                    if !merged.tags.contains(tag) {
                        merged.tags.push(tag.clone());
                    }
                }
                if incoming.confidence > merged.confidence {
                    merged.confidence = incoming.confidence;
                }
                merged
            }
        }
    }
}
