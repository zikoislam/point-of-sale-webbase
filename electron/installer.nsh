; Installer extras for BDBBC POS.
;
; The offline edition ships MongoDB so the shop can sell without internet.
; MongoDB 7 needs the Microsoft Visual C++ Redistributable: on a clean Windows
; PC mongod.exe refuses to start without it, the API then has no database and
; the window shows "Internal Server Error". The redist is bundled next to
; mongod, so install it here (per-user install plus allowElevation already
; requests elevation) and the app works on a fresh machine.

!include "LogicLib.nsh"

!macro customInstall
  ${If} ${FileExists} "$INSTDIR\resources\mongodb\bin\vc_redist.x64.exe"
    DetailPrint "Installing Microsoft Visual C++ Redistributable (required by the database)..."
    ExecWait '"$INSTDIR\resources\mongodb\bin\vc_redist.x64.exe" /install /quiet /norestart'
  ${EndIf}
!macroend
