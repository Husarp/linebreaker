Unicode true
ManifestDPIAware true
ManifestDPIAwareness PerMonitorV2
RequestExecutionLevel user
SilentInstall silent
SilentUnInstall silent
SetCompressor /SOLID lzma

!include FileFunc.nsh
!include "{{installer_hooks}}"

Name "{{product_name}} Setup"
Icon "{{installer_icon}}"
UninstallIcon "{{installer_icon}}"
OutFile "{{out_file}}"
VIProductVersion "{{version_with_build}}"
VIAddVersionKey "ProductName" "{{product_name}}"
VIAddVersionKey "FileDescription" "{{product_name}} Setup"
VIAddVersionKey "FileVersion" "{{version}}"
VIAddVersionKey "ProductVersion" "{{version}}"

Section
  InitPluginsDir
  ${GetParameters} $1
  stage:
    ClearErrors
    SetOutPath "$PLUGINSDIR"
    !insertmacro LB_STAGE_MAINTENANCE
    File "/oname=WebView2Setup.exe" "{{webview2_bootstrapper_path}}"
    SetOutPath "$PLUGINSDIR\payload"
    File "{{main_binary_path}}"
    {{#each resources}}
    SetOutPath "$PLUGINSDIR\payload\{{this.[0]}}"
    File /a "/oname={{this.[1]}}" "{{no-escape @key}}"
    {{/each}}
    SetOutPath "$PLUGINSDIR\payload"
    {{#each binaries}}
    File /a "/oname={{this}}" "{{no-escape @key}}"
    {{/each}}
    WriteUninstaller "$PLUGINSDIR\payload\uninstall.exe"
    IfErrors stage_error
    SetOutPath "$PLUGINSDIR"
    ExecWait '"$PLUGINSDIR\LinebreakerMaintenance.exe" --setup "{{version}}" $1' $0
    IfErrors stage_error
    SetErrorLevel $0
    Goto done
  stage_error:
    MessageBox MB_RETRYCANCEL|MB_ICONSTOP "Setup could not prepare its temporary files. Check free disk space, then try again." IDRETRY stage
    !insertmacro LB_RESTART_PREVIOUS_ON_UPDATE $1
    SetErrorLevel 1
  done:
    SetOutPath "$TEMP"
SectionEnd

Section "Uninstall"
  InitPluginsDir
  clear:
    ClearErrors
    SetOutPath "$PLUGINSDIR"
    !insertmacro LB_STAGE_MAINTENANCE
    IfErrors unstage_error
    ExecWait '"$PLUGINSDIR\LinebreakerMaintenance.exe" --uninstall' $0
    IfErrors unstage_error
    SetErrorLevel $0
    Goto und_done
  unstage_error:
    MessageBox MB_RETRYCANCEL|MB_ICONSTOP "Setup could not start removal. Check free disk space, then try again." IDRETRY clear
    SetErrorLevel 1
  und_done:
    SetOutPath "$TEMP"
SectionEnd
