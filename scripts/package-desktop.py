"""Reproducibly package the Windows source launcher; no binaries or secrets."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
root=Path(__file__).resolve().parents[1]
target=root/'dist/downloads/letitia-boss-guard-windows.zip'
target.parent.mkdir(parents=True,exist_ok=True)
with ZipFile(target,'w',compression=ZIP_DEFLATED) as archive:
    for name in ['app.py','tracker.py','windows.py','start.bat','requirements.txt','model.sha256','README.md','MEDIAPIPE-LICENSE.txt']:
        info=ZipInfo('letitia-boss-guard/'+name,date_time=(2026,9,10,0,0,0))
        info.compress_type=ZIP_DEFLATED
        archive.writestr(info,(root/'desktop/boss-guard'/name).read_bytes())
print(target)
