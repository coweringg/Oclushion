use super::PtyHandler;
use crate::TerminalError;
use std::os::raw::c_int;
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
use windows_sys::Win32::System::Console::{
    COORD, CreatePseudoConsole, ResizePseudoConsole, HPCON,
};
use windows_sys::Win32::System::Pipes::CreatePipe;
use windows_sys::Win32::System::Threading::{
    CreateProcessW, InitializeProcThreadAttributeList, TerminateProcess,
    UpdateProcThreadAttribute, EXTENDED_STARTUPINFO_PRESENT, PROCESS_INFORMATION,
    PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE, STARTF_USESTDHANDLES, STARTUPINFOW,
    STARTUPINFOEXW,
};
use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;

pub struct WindowsPty {
    console_handle: HPCON,
    input_reader: HANDLE,
    input_writer: HANDLE,
    output_reader: HANDLE,
    output_writer: HANDLE,
    process_handle: HANDLE,
    child_pid: u32,
}

impl WindowsPty {
    pub fn open(shell: &str) -> Result<Self, TerminalError> {
        let mut input_read: HANDLE = 0;
        let mut input_write: HANDLE = 0;
        let mut output_read: HANDLE = 0;
        let mut output_write: HANDLE = 0;

        let sa = SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: std::ptr::null_mut(),
            bInheritHandle: 1,
        };

        let ok1 = unsafe {
            CreatePipe(&mut input_read, &mut input_write, &sa, 0)
        };
        let ok2 = unsafe {
            CreatePipe(&mut output_read, &mut output_write, &sa, 0)
        };

        if ok1 == 0 || ok2 == 0 {
            return Err(TerminalError::PtySpawn("CreatePipe failed".into()));
        }

        let coord = COORD { X: 80, Y: 24 };
        let mut console_handle: HPCON = 0;
        let hr = unsafe {
            CreatePseudoConsole(coord, input_read, output_write, 0, &mut console_handle)
        };

        if hr != 0 {
            unsafe { CloseHandle(input_write); CloseHandle(output_read); }
            return Err(TerminalError::PtySpawn("CreatePseudoConsole failed".into()));
        }

        let shell_path = if shell.contains("pwsh") || shell.contains("powershell") {
            format!("{} -NoLogo", shell)
        } else {
            shell.to_string()
        };

        let mut shell_cstr = to_wstring(&shell_path);
        let mut startup_info = STARTUPINFOEXW {
            StartupInfo: STARTUPINFOW {
                cb: std::mem::size_of::<STARTUPINFOEXW>() as u32,
                lpReserved: std::ptr::null_mut(),
                lpDesktop: std::ptr::null_mut(),
                lpTitle: std::ptr::null_mut(),
                dwX: 0, dwY: 0, dwXSize: 0, dwYSize: 0,
                dwXCountChars: 0, dwYCountChars: 0,
                dwFillAttribute: 0,
                dwFlags: STARTF_USESTDHANDLES,
                wShowWindow: 0,
                cbReserved2: 0,
                lpReserved2: std::ptr::null_mut(),
                hStdInput: input_read,
                hStdOutput: output_write,
                hStdError: output_write,
            },
            lpAttributeList: std::ptr::null_mut(),
        };

        let mut proc_info = PROCESS_INFORMATION {
            hProcess: 0,
            hThread: 0,
            dwProcessId: 0,
            dwThreadId: 0,
        };

        let mut attrs = vec![0u8; 1024];
        let mut sz: usize = 0;
        unsafe {
            InitializeProcThreadAttributeList(
                std::ptr::null_mut(),
                1,
                0,
                &mut sz,
            );
            startup_info.lpAttributeList = attrs.as_mut_ptr() as *mut _;
            InitializeProcThreadAttributeList(
                startup_info.lpAttributeList,
                1,
                0,
                &mut sz,
            );
            UpdateProcThreadAttribute(
                startup_info.lpAttributeList,
                0,
                PROC_THREAD_ATTRIBUTE_PSEUDOCONSOLE as usize,
                &console_handle as *const _ as *mut _,
                std::mem::size_of::<HPCON>(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
            );
        }

        let ok4 = unsafe {
            CreateProcessW(
                std::ptr::null(),
                shell_cstr.as_mut_ptr(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                1,
                EXTENDED_STARTUPINFO_PRESENT,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                &startup_info.StartupInfo,
                &mut proc_info,
            )
        };

        if ok4 == 0 {
            unsafe { CloseHandle(console_handle); CloseHandle(input_read); CloseHandle(output_write); }
            return Err(TerminalError::PtySpawn("CreateProcessW failed".into()));
        }

        unsafe {
            CloseHandle(proc_info.hThread);
        }

        Ok(Self {
            console_handle,
            input_reader: input_read,
            input_writer: input_write,
            output_reader: output_read,
            output_writer: output_write,
            process_handle: proc_info.hProcess,
            child_pid: proc_info.dwProcessId,
        })
    }
}

impl PtyHandler for WindowsPty {
    fn fd_read(&self) -> c_int {
        self.output_reader as c_int
    }

    fn fd_write(&self) -> c_int {
        self.input_writer as c_int
    }

    fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        let coord = COORD { X: cols as i16, Y: rows as i16 };
        unsafe { ResizePseudoConsole(self.console_handle, coord) };
        Ok(())
    }

    fn shutdown(self: Box<Self>) -> Result<(), TerminalError> {
        unsafe {
            CloseHandle(self.console_handle);
            TerminateProcess(self.process_handle, 0);
            CloseHandle(self.process_handle);
            CloseHandle(self.input_reader);
            CloseHandle(self.input_writer);
            CloseHandle(self.output_reader);
            CloseHandle(self.output_writer);
        }
        Ok(())
    }

    fn shell_pid(&self) -> u32 {
        self.child_pid
    }
}

fn to_wstring(s: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(s)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect()
}
