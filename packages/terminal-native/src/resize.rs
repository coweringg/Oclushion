use crate::TerminalError;

pub struct ResizeHandle;

pub fn handle_resize(pty: &dyn crate::pty::PtyHandler, cols: u16, rows: u16) -> Result<(), TerminalError> {
    pty.resize(cols, rows).map_err(|e| TerminalError::Resize(e))
}

pub fn optimal_cell_size(available_width: u32, available_height: u32, font_size: f64) -> (u16, u16) {
    let cell_width = font_size as u32 * 6 / 10;
    let cell_height = (font_size * 1.2) as u32;
    let cols = if cell_width > 0 { available_width / cell_width } else { 80 };
    let rows = if cell_height > 0 { available_height / cell_height } else { 24 };
    (cols.max(10) as u16, rows.max(4) as u16)
}
