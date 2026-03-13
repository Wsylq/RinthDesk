use std::fs::File;
use std::io::{BufWriter, Read, Write};
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

#[tauri::command]
fn pick_folder() -> Result<Option<String>, String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-WindowStyle",
            "Hidden",
            "-Command",
            "Add-Type -AssemblyName System.Windows.Forms; \
             $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; \
             $dialog.Description = 'Choose download folder'; \
             if ($dialog.ShowDialog() -eq 'OK') { Write-Output $dialog.SelectedPath }",
        ])
        .output()
        .map_err(|_| "couldn't open folder dialog".to_string())?;

    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if path.is_empty() {
        Ok(None)
    } else {
        Ok(Some(path))
    }
}

#[tauri::command]
fn download_file(url: String, file_name: String, folder_path: String) -> Result<(), String> {
    if file_name.contains('/') || file_name.contains('\\') {
        return Err("Invalid file name".to_string());
    }

    let folder = PathBuf::from(&folder_path);
    if !folder.exists() {
        std::fs::create_dir_all(&folder)
            .map_err(|err| format!("Failed to create folder: {err}"))?;
    }

    let output_path = folder.join(&file_name);

    let response = ureq::get(&url)
        .call()
        .map_err(|err| format!("Request failed: {err}"))?;

    if response.status() >= 400 {
        return Err(format!("HTTP error {}", response.status()));
    }

    let mut reader = response.into_reader();
    let file =
        File::create(&output_path).map_err(|err| format!("Failed to create file: {err}"))?;
    let mut writer = BufWriter::new(file);

    let mut buffer = [0_u8; 32 * 1024];
    loop {
        let bytes_read = reader
            .read(&mut buffer)
            .map_err(|err| format!("Download stream error: {err}"))?;

        if bytes_read == 0 {
            break;
        }

        writer
            .write_all(&buffer[..bytes_read])
            .map_err(|err| format!("Write error: {err}"))?;
    }

    writer
        .flush()
        .map_err(|err| format!("Flush error: {err}"))?;

    Ok(())
}

#[tauri::command]
fn list_folder_files(folder_path: String) -> Result<Vec<String>, String> {
    let path = PathBuf::from(folder_path);
    if !path.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    let entries = std::fs::read_dir(path).map_err(|err| format!("Failed to read folder: {err}"))?;
    for entry in entries {
        let entry = entry.map_err(|err| format!("Failed to read entry: {err}"))?;
        let file_type = entry
            .file_type()
            .map_err(|err| format!("Failed to read entry type: {err}"))?;
        if file_type.is_file() {
            files.push(entry.file_name().to_string_lossy().to_string());
        }
    }

    Ok(files)
}

#[tauri::command]
fn remove_file(folder_path: String, file_name: String) -> Result<(), String> {
    if file_name.contains('/') || file_name.contains('\\') {
        return Err("Invalid file name".to_string());
    }

    let path = PathBuf::from(folder_path).join(file_name);
    if !path.exists() {
        return Ok(());
    }

    std::fs::remove_file(path).map_err(|err| format!("Failed to remove file: {err}"))?;
    Ok(())
}

#[tauri::command]
fn open_folder(folder_path: String) -> Result<(), String> {
    eprintln!("open_folder: {}", folder_path);
    let status = Command::new("explorer")
        .arg(folder_path)
        .status()
        .map_err(|err| format!("Failed to open folder: {err}"))?;

    if !status.success() {
        return Err("Explorer returned non-zero status".to_string());
    }

    Ok(())
}

#[tauri::command]
fn window_minimize(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?;
    window.minimize().map_err(|err| format!("Failed to minimize: {err}"))
}

#[tauri::command]
fn window_toggle_maximize(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?;

    let is_maximized = window
        .is_maximized()
        .map_err(|err| format!("Failed to read window state: {err}"))?;

    if is_maximized {
        window
            .unmaximize()
            .map_err(|err| format!("Failed to unmaximize: {err}"))
    } else {
        window
            .maximize()
            .map_err(|err| format!("Failed to maximize: {err}"))
    }
}

#[tauri::command]
fn window_close(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?;
    window.close().map_err(|err| format!("Failed to close: {err}"))
}

#[tauri::command]
fn window_start_dragging(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?;
    window
        .start_dragging()
        .map_err(|err| format!("Failed to start dragging: {err}"))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            pick_folder,
            download_file,
            list_folder_files,
            remove_file,
            open_folder,
            window_minimize,
            window_toggle_maximize,
            window_close,
            window_start_dragging
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
