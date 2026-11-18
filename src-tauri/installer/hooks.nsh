!define LB_SETUP_FILES "${__FILEDIR__}\generated"

!macro LB_STAGE_MAINTENANCE
  File "${LB_SETUP_FILES}\LinebreakerMaintenance.exe"
!macroend

!macro LB_RESTART_PREVIOUS_ON_UPDATE PARAMETERS
  ClearErrors
  ${GetOptions} ${PARAMETERS} "--update" $2
  IfErrors 0 restart_previous
  ClearErrors
  ${GetOptions} ${PARAMETERS} "/UPDATE" $2
  IfErrors after_restart
  restart_previous:
    ReadRegStr $2 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Linebreaker" "InstallLocation"
    StrCmp $2 "" after_restart
    StrCpy $3 $2 1
    StrCmp $3 '$\"' 0 +2
    StrCpy $2 $2 -1 1
    IfFileExists "$2\linebreaker.exe" 0 after_restart
    Exec '"$2\linebreaker.exe"'
  after_restart:
!macroend
