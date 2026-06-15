use std::env;
use std::path::PathBuf;
use std::process::Command;

fn main() {
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    let vendor_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap()).join("vendor").join("libghostty");

    let target = env::var("TARGET").unwrap();
    let dev_mode = env::var("GHOSTTY_DEV").is_ok() || !vendor_dir.join("ghostty.h").exists();

    if dev_mode {
        println!("cargo:warning=libghostty not available — generating stub bindings for development checks");
        generate_stub_bindings(&out_dir);
        return;
    }

    let zig_exe = which_zig();
    println!("cargo:rerun-if-changed=vendor/libghostty/src/");
    println!("cargo:rerun-if-changed=build.rs");

    let mut zig_cmd = Command::new(&zig_exe);
    zig_cmd
        .arg("build")
        .arg("--prefix")
        .arg(out_dir.join("ghostty"))
        .arg("-Doptimize=ReleaseFast")
        .current_dir(&vendor_dir);

    if target.contains("x86_64") {
        zig_cmd.arg("-Dcpu=x86_64_v3");
    }

    let status = zig_cmd.status().expect("Failed to compile libghostty with Zig");
    if !status.success() {
        panic!("libghostty compilation failed with status: {}", status);
    }

    let lib_dir = out_dir.join("ghostty").join("lib");
    println!("cargo:rustc-link-search=native={}", lib_dir.display());
    println!("cargo:rustc-link-lib=static=ghostty");

    emit_platform_links();

    let bindings = bindgen::Builder::default()
        .header(vendor_dir.join("ghostty.h").to_string_lossy())
        .allowlist_var("GHOSTTY_.*")
        .allowlist_function("ghostty_.*")
        .allowlist_type("ghostty_.*")
        .derive_default(true)
        .derive_debug(true)
        .layout_tests(true)
        .generate()
        .expect("Unable to generate bindgen bindings for libghostty");

    bindings
        .write_to_file(out_dir.join("ghostty_bindings.rs"))
        .expect("Could not write bindings file");

    println!("cargo:rerun-if-changed=vendor/libghostty/ghostty.h");
}

fn generate_stub_bindings(out_dir: &PathBuf) {
    let stub = r#"#[allow(non_upper_case_globals, non_camel_case_types, non_snake_case, dead_code)]
pub type ghostty_config_s = std::ffi::c_void;
pub type ghostty_terminal_s = std::ffi::c_void;
pub type ghostty_surface_s = std::ffi::c_void;
pub unsafe fn ghostty_config_new() -> *mut ghostty_config_s { std::ptr::null_mut() }
pub unsafe fn ghostty_config_free(_: *mut ghostty_config_s) {}
pub unsafe fn ghostty_config_set(_: *mut ghostty_config_s, _: *const i8, _: *const i8) -> i32 { 0 }
pub unsafe fn ghostty_terminal_new(_: *const ghostty_config_s) -> *mut ghostty_terminal_s { std::ptr::null_mut() }
pub unsafe fn ghostty_terminal_free(_: *mut ghostty_terminal_s) {}
pub unsafe fn ghostty_terminal_inject(_: *mut ghostty_terminal_s, _: *const i8, _: usize) -> i32 { 0 }
pub unsafe fn ghostty_terminal_read(_: *mut ghostty_terminal_s, _: *mut i8, _: usize) -> i32 { 0 }
pub unsafe fn ghostty_terminal_resize(_: *mut ghostty_terminal_s, _: u32, _: u32) {}
pub unsafe fn ghostty_terminal_render(_: *mut ghostty_terminal_s, _: u64) -> i32 { 0 }
pub unsafe fn ghostty_surface_new(_: *mut ghostty_terminal_s, _: u32, _: u32, _: f64) -> *mut ghostty_surface_s { std::ptr::null_mut() }
pub unsafe fn ghostty_surface_free(_: *mut ghostty_surface_s) {}
pub unsafe fn ghostty_surface_id(_: *mut ghostty_surface_s) -> u64 { 0 }
pub unsafe fn ghostty_version() -> *const i8 { b"0.0.0\0" as *const u8 as *const i8 }"#;
    std::fs::write(out_dir.join("ghostty_bindings.rs"), stub).expect("write stub bindings");
}

fn which_zig() -> String {
    if let Ok(path) = env::var("ZIG_EXE") {
        return path;
    }
    for name in &["zig", "zig.exe"] {
        if let Ok(path) = std::process::Command::new(name).arg("version").output() {
            if path.status.success() {
                return name.to_string();
            }
        }
    }
    panic!("Zig compiler not found. Install Zig (https://ziglang.org/download) or set ZIG_EXE.");
}

fn emit_platform_links() {
    if cfg!(target_os = "macos") {
        println!("cargo:rustc-link-lib=framework=Metal");
        println!("cargo:rustc-link-lib=framework=Cocoa");
        println!("cargo:rustc-link-lib=framework=CoreGraphics");
        println!("cargo:rustc-link-lib=framework=CoreText");
    } else if cfg!(target_os = "linux") {
        println!("cargo:rustc-link-lib=X11");
        println!("cargo:rustc-link-lib=wayland-client");
        println!("cargo:rustc-link-lib=freetype");
    } else if cfg!(windows) {
        println!("cargo:rustc-link-lib=d3d11");
        println!("cargo:rustc-link-lib=dxgi");
    }
}
