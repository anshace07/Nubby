; ---------------------------------------------------------------------------
; Nubby — Windows installer (per-user, no admin rights needed)
;
;   makensis installer/nubby.nsi
;
; Expects installer/payload/Nubby.exe and installer/payload/WebView2Loader.dll
; and writes release/Nubby_<version>_x64-setup.exe.
; Your notes live in Documents\Nubby and are never touched by (un)installing.
; ---------------------------------------------------------------------------

Unicode true
ManifestDPIAware true
SetCompressor /SOLID lzma
RequestExecutionLevel user

!define APP "Nubby"
!define VERSION "0.1.2"
!define PUBLISHER "Ayush Mishra"
!define APPID "com.ayushmishra.nubby"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPID}"
!define WEBVIEW2_GUID "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "WinMessages.nsh"

Name "${APP}"
OutFile "../release/Nubby_${VERSION}_x64-setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Nubby"
InstallDirRegKey HKCU "Software\${APPID}" "InstallDir"
BrandingText "Nubby ${VERSION} · free, local, offline"

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "${APP}"
VIAddVersionKey "FileDescription" "Nubby installer"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "CompanyName" "${PUBLISHER}"
VIAddVersionKey "LegalCopyright" "(c) 2026 ${PUBLISHER} - MIT licence"

; ---------- look ----------
!define MUI_ICON "nubby.ico"
!define MUI_UNICON "nubby.ico"
!define MUI_WELCOMEFINISHPAGE_BITMAP "welcome.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "welcome.bmp"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "header.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "header.bmp"
!define MUI_ABORTWARNING

; ---------- pages ----------
!define MUI_WELCOMEPAGE_TITLE "Nubby — a paper notebook for typed notes"
!define MUI_WELCOMEPAGE_TEXT "Handwriting fonts, ink colours, sticky notes and pictures you can put anywhere on the page.$\r$\n$\r$\nNubby is free, works offline and keeps every note on this PC, in Documents\Nubby. No account, no cloud.$\r$\n$\r$\nClick Install to add Nubby to your Start menu and desktop."
!define MUI_PAGE_CUSTOMFUNCTION_SHOW WelcomeShow
!insertmacro MUI_PAGE_WELCOME

!insertmacro MUI_PAGE_INSTFILES

!define MUI_FINISHPAGE_TITLE "Nubby is ready"
!define MUI_FINISHPAGE_TEXT "You'll find Nubby on your desktop and in the Start menu.$\r$\n$\r$\nYour notes are saved in Documents\Nubby — back that folder up and you've backed up everything."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Nubby.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Open Nubby now"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Function WelcomeShow
  ; The welcome page's button installs straight away.
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${WM_SETTEXT} 0 "STR:&Install"
FunctionEnd

Function CheckWebView2
  ; Windows 10/11 normally ship the WebView2 runtime that Nubby draws its pages with.
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
  StrCmp $0 "" 0 found
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
  StrCmp $0 "" 0 found
  ReadRegStr $0 HKCU "Software\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
  StrCmp $0 "" 0 found
  MessageBox MB_YESNO|MB_ICONINFORMATION "Nubby needs Microsoft Edge WebView2, a free part of Windows that isn't on this PC yet.$\r$\n$\r$\nOpen Microsoft's download page now?" /SD IDNO IDNO found
  ExecShell "open" "https://go.microsoft.com/fwlink/p/?LinkId=2124703"
  found:
FunctionEnd

Section "Nubby" SecMain
  SetShellVarContext current
  SetOutPath "$INSTDIR"

  ; When updating, Nubby may still be open. Ask to close it first.
  retry:
  ClearErrors
  IfFileExists "$INSTDIR\Nubby.exe" 0 copy_files
  Delete "$INSTDIR\Nubby.exe"
  IfErrors 0 copy_files
  MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Nubby is open. Close it (your notes are already saved), then click Retry." /SD IDCANCEL IDRETRY retry
  Abort "Nubby was open, so nothing was changed."

  copy_files:
  File "payload/Nubby.exe"
  File "payload/WebView2Loader.dll"
  WriteUninstaller "$INSTDIR\Uninstall Nubby.exe"

  CreateShortcut "$SMPROGRAMS\Nubby.lnk" "$INSTDIR\Nubby.exe" "" "$INSTDIR\Nubby.exe" 0 SW_SHOWNORMAL "" "A paper notebook for typed notes"
  CreateShortcut "$DESKTOP\Nubby.lnk" "$INSTDIR\Nubby.exe" "" "$INSTDIR\Nubby.exe" 0 SW_SHOWNORMAL "" "A paper notebook for typed notes"

  WriteRegStr HKCU "Software\${APPID}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\Nubby.exe"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall Nubby.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall Nubby.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" "$0"

  Call CheckWebView2
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$INSTDIR\Nubby.exe"
  Delete "$INSTDIR\WebView2Loader.dll"
  Delete "$INSTDIR\Uninstall Nubby.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\Nubby.lnk"
  Delete "$DESKTOP\Nubby.lnk"
  ; Window size, theme and other small preferences (not your notes).
  RMDir /r "$LOCALAPPDATA\${APPID}"
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\${APPID}"
  ; Your notes in Documents\Nubby are left exactly where they are.
SectionEnd
