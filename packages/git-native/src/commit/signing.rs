use crate::repository::Repository;

pub struct CommitSigning;

impl CommitSigning {
    pub fn is_signing_configured(repo: &Repository) -> bool {
        let config = repo.config_snapshot();
        if let Some(value) = config.string("commit.gpgsign") {
            return value.as_ref() == b"true"
                || value.as_ref() == b"1"
                || value.as_ref() == b"yes";
        }
        if let Some(_) = config.string("user.signingkey") {
            return true;
        }
        false
    }

    pub fn get_signing_key(repo: &Repository) -> crate::Result<Option<String>> {
        let config = repo.config_snapshot();

        if let Some(key) = config.string("user.signingkey") {
            return Ok(Some(
                String::from_utf8_lossy(key.as_ref()).to_string(),
            ));
        }

        Ok(None)
    }
}
