//! Nubby's backend is deliberately tiny: a safe, local file store.
//!
//! Everything lives in one folder the user owns (`Documents\Nubby` by default):
//!
//! ```text
//! Nubby/
//!   shelf.json                      order of notebooks on the shelf
//!   board.json                      the loose sticky-note board
//!   notebooks/<id>/notebook.json    title, cover, paper, page order
//!   notebooks/<id>/pages/<id>.json  one file per page (text + images + stickies)
//!   notebooks/<id>/assets/<file>    pasted / imported pictures
//!   Exports/                        PNG exports
//! ```
//!
//! The web UI only ever passes paths *relative* to that folder. Anything that
//! tries to climb out of it (`..`, drive letters, absolute paths) is rejected.

use std::fs;
use std::io::{ErrorKind, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::ipc::{InvokeBody, Request, Response};
use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Manager, State};

struct Store {
    root: Mutex<PathBuf>,
}

fn default_root(app: &tauri::AppHandle) -> PathBuf {
    let base = app
        .path()
        .document_dir()
        .or_else(|_| app.path().home_dir())
        .unwrap_or_else(|_| PathBuf::from("."));
    base.join("Nubby")
}

fn root(store: &State<Store>) -> Result<PathBuf, String> {
    let r = store
        .root
        .lock()
        .map_err(|_| "storage lock poisoned".to_string())?
        .clone();
    fs::create_dir_all(&r).map_err(|e| format!("cannot create {}: {e}", r.display()))?;
    Ok(r)
}

/// Resolve a UI-supplied relative path to an absolute path inside the root.
fn resolve(store: &State<Store>, rel: &str) -> Result<PathBuf, String> {
    let rel = rel.trim();
    if rel.is_empty() {
        return root(store);
    }
    let rel_path = Path::new(rel);
    for c in rel_path.components() {
        if !matches!(c, Component::Normal(_)) {
            return Err(format!("invalid path: {rel}"));
        }
    }
    Ok(root(store)?.join(rel_path))
}

/// Write to a temp file, flush it to disk, then swap it into place.
/// A crash mid-write leaves the previous version intact.
fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("cannot create {}: {e}", parent.display()))?;
    }
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("file");
    let tmp = path.with_file_name(format!(".{name}.{nanos}.tmp"));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| format!("cannot write {}: {e}", tmp.display()))?;
        f.write_all(bytes).map_err(|e| format!("cannot write {}: {e}", tmp.display()))?;
        f.sync_all().map_err(|e| format!("cannot flush {}: {e}", tmp.display()))?;
    }
    if let Err(first) = fs::rename(&tmp, path) {
        // Rarely, another program (antivirus, sync tools) holds the target open.
        // Fall back to copying over it.
        let copied = fs::copy(&tmp, path);
        let _ = fs::remove_file(&tmp);
        copied.map_err(|e| format!("cannot save {}: {first}; {e}", path.display()))?;
    }
    Ok(())
}

fn percent_decode(s: &str) -> Result<String, String> {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).map_err(|_| "bad path encoding")?;
            let v = u8::from_str_radix(hex, 16).map_err(|_| "bad path encoding")?;
            out.push(v);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).map_err(|_| "bad path encoding".to_string())
}

#[tauri::command]
fn storage_root(store: State<Store>) -> Result<String, String> {
    Ok(root(&store)?.to_string_lossy().to_string())
}

#[tauri::command]
fn read_text(store: State<Store>, rel: String) -> Result<Option<String>, String> {
    let p = resolve(&store, &rel)?;
    match fs::read_to_string(&p) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("cannot read {rel}: {e}")),
    }
}

#[tauri::command]
fn write_text(store: State<Store>, rel: String, contents: String) -> Result<(), String> {
    let p = resolve(&store, &rel)?;
    atomic_write(&p, contents.as_bytes())
}

#[derive(Serialize)]
struct Entry {
    name: String,
    dir: bool,
}

#[tauri::command]
fn list_dir(store: State<Store>, rel: String) -> Result<Vec<Entry>, String> {
    let p = resolve(&store, &rel)?;
    let rd = match fs::read_dir(&p) {
        Ok(rd) => rd,
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(vec![]),
        Err(e) => return Err(format!("cannot list {rel}: {e}")),
    };
    let mut out = Vec::new();
    for entry in rd.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue; // temp files from atomic_write
        }
        let dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        out.push(Entry { name, dir });
    }
    Ok(out)
}

#[tauri::command]
fn remove_path(store: State<Store>, rel: String) -> Result<(), String> {
    if rel.trim().is_empty() {
        return Err("refusing to remove the whole Nubby folder".into());
    }
    let p = resolve(&store, &rel)?;
    let result = if p.is_dir() {
        fs::remove_dir_all(&p)
    } else if p.exists() {
        fs::remove_file(&p)
    } else {
        return Ok(());
    };
    result.map_err(|e| format!("cannot remove {rel}: {e}"))
}

/// Raw bytes (pictures, exports). The target path rides in a header so the
/// body can stay binary. Returns the absolute path that was written.
#[tauri::command]
fn write_bytes(store: State<Store>, request: Request<'_>) -> Result<String, String> {
    let InvokeBody::Raw(data) = request.body() else {
        return Err("expected raw bytes".into());
    };
    let header = request
        .headers()
        .get("x-nubby-path")
        .and_then(|v| v.to_str().ok())
        .ok_or("missing x-nubby-path header")?;
    let rel = percent_decode(header)?;
    let p = resolve(&store, &rel)?;
    atomic_write(&p, data)?;
    Ok(p.to_string_lossy().to_string())
}

#[tauri::command]
fn read_bytes(store: State<Store>, rel: String) -> Result<Response, String> {
    let p = resolve(&store, &rel)?;
    let data = fs::read(&p).map_err(|e| format!("cannot read {rel}: {e}"))?;
    Ok(Response::new(data))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Hit {
    notebook_id: String,
    page_id: String,
    snippet: String,
}

/// Case-insensitive search over the plain text saved with every page.
#[tauri::command]
fn search_pages(store: State<Store>, query: String) -> Result<Vec<Hit>, String> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Ok(vec![]);
    }
    let q_chars = q.chars().count();
    let notebooks = root(&store)?.join("notebooks");
    let mut hits = Vec::new();
    for nb in fs::read_dir(&notebooks).into_iter().flatten().flatten() {
        if !nb.path().is_dir() {
            continue;
        }
        let notebook_id = nb.file_name().to_string_lossy().to_string();
        for page in fs::read_dir(nb.path().join("pages")).into_iter().flatten().flatten() {
            let path = page.path();
            if path.extension().and_then(|e| e.to_str()) != Some("json") {
                continue;
            }
            let Ok(raw) = fs::read_to_string(&path) else { continue };
            let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) else { continue };
            let text = v.get("text").and_then(|t| t.as_str()).unwrap_or("");
            let lower = text.to_lowercase();
            let Some(byte_pos) = lower.find(&q) else { continue };
            let pos = lower[..byte_pos].chars().count();
            let chars: Vec<char> = text.chars().collect();
            let start = pos.saturating_sub(40);
            let end = (pos + q_chars + 90).min(chars.len());
            let mut snippet: String = chars[start.min(chars.len())..end].iter().collect();
            snippet = snippet.split_whitespace().collect::<Vec<_>>().join(" ");
            if start > 0 {
                snippet = format!("…{snippet}");
            }
            if end < chars.len() {
                snippet.push('…');
            }
            let page_id = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            hits.push(Hit { notebook_id: notebook_id.clone(), page_id, snippet });
            if hits.len() >= 200 {
                return Ok(hits);
            }
        }
    }
    Ok(hits)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(target_os = "macos")]
    let builder = with_mac_menu(builder);
    builder
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let root = default_root(app.handle());
            let _ = fs::create_dir_all(&root);
            app.manage(Store { root: Mutex::new(root) });

            // On small laptop screens, open maximized instead of hanging off the edge.
            if let Some(win) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = win.current_monitor() {
                    let size = monitor.size().to_logical::<f64>(monitor.scale_factor());
                    if size.width < 1400.0 || size.height < 900.0 {
                        let _ = win.maximize();
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            storage_root,
            read_text,
            write_text,
            list_dir,
            remove_path,
            write_bytes,
            read_bytes,
            search_pages
        ])
        .run(tauri::generate_context!())
        .expect("error while running Nubby");
}

/// The Mac menu bar: the usual App / Edit / View / Window menus, except that Quit
/// closes the window the normal way first, so the page saves what was just typed.
/// (The stock Quit item ends the app without asking the window.) Built on every
/// platform so it is type-checked everywhere, attached only on macOS.
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn mac_menu<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    let quit = MenuItem::with_id(app, "quit", "Quit Nubby", true, Some("CmdOrCtrl+Q"))?;
    let app_menu = Submenu::with_items(
        app,
        "Nubby",
        true,
        &[
            &PredefinedMenuItem::about(app, Some("About Nubby"), Some(AboutMetadata::default()))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;
    let view = Submenu::with_items(app, "View", true, &[&PredefinedMenuItem::fullscreen(app, None)?])?;
    let window = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;
    Menu::with_items(app, &[&app_menu, &edit, &view, &window])
}

/// Puts the Mac menu bar on the app (called on macOS only).
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn with_mac_menu(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.menu(|app| mac_menu(app)).on_menu_event(|app, event| {
        if event.id().as_ref() == "quit" {
            quit_after_save(app);
        }
    })
}

/// Quit after the open page has saved: close the window (which saves, then exits).
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
fn quit_after_save<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    match app.get_webview_window("main") {
        Some(win) if win.close().is_ok() => {}
        _ => app.exit(0),
    }
}
