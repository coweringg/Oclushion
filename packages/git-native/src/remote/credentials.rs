use std::process::Command;

pub struct CredentialHelper;

impl CredentialHelper {
    pub fn get_ssh_key_path() -> Option<String> {
        if let Ok(home) = std::env::var("HOME") {
            let ssh_dir = std::path::Path::new(&home).join(".ssh");
            for key_name in &["id_ed25519", "id_rsa", "id_ecdsa", "id_ecdsa_sk", "id_ed25519_sk"] {
                let key_path = ssh_dir.join(key_name);
                if key_path.exists() {
                    return Some(key_path.to_string_lossy().to_string());
                }
            }
        }

        if let Ok(home) = std::env::var("USERPROFILE") {
            let ssh_dir = std::path::Path::new(&home).join(".ssh");
            for key_name in &["id_ed25519", "id_rsa", "id_ecdsa", "id_ecdsa_sk", "id_ed25519_sk"] {
                let key_path = ssh_dir.join(key_name);
                if key_path.exists() {
                    return Some(key_path.to_string_lossy().to_string());
                }
            }
        }

        None
    }

    pub fn get_git_credential_helper() -> Option<String> {
        let output = Command::new("git")
            .args(["config", "--global", "credential.helper"])
            .output()
            .ok()?;

        if output.status.success() {
            let helper = String::from_utf8_lossy(&output.stdout).to_string();
            let helper = helper.trim().to_string();
            if !helper.is_empty() {
                return Some(helper);
            }
        }

        let output = Command::new("git")
            .args(["config", "credential.helper"])
            .output()
            .ok()?;

        if output.status.success() {
            let helper = String::from_utf8_lossy(&output.stdout).to_string();
            let helper = helper.trim().to_string();
            if !helper.is_empty() {
                return Some(helper);
            }
        }

        None
    }
}
