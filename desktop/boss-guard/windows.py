"""Only manipulate the Excel HWND explicitly selected by the user."""
import ctypes as c
from ctypes import wintypes as w

u=c.WinDLL('user32',use_last_error=True)
k=c.WinDLL('kernel32',use_last_error=True)
CALLBACK=c.WINFUNCTYPE(w.BOOL,w.HWND,w.LPARAM)
class Placement(c.Structure):
    _fields_=[('length',w.UINT),('flags',w.UINT),('showCmd',w.UINT),('ptMinPosition',w.POINT),('ptMaxPosition',w.POINT),('rcNormalPosition',w.RECT)]
u.GetForegroundWindow.restype=w.HWND
u.IsWindow.argtypes=[w.HWND]
u.IsWindowVisible.argtypes=[w.HWND]
u.GetClassNameW.argtypes=[w.HWND,w.LPWSTR,c.c_int]
u.GetWindowTextW.argtypes=[w.HWND,w.LPWSTR,c.c_int]
u.EnumWindows.argtypes=[CALLBACK,w.LPARAM]
u.ShowWindow.argtypes=[w.HWND,c.c_int]
u.SetForegroundWindow.argtypes=[w.HWND]
u.GetWindowThreadProcessId.argtypes=[w.HWND,c.POINTER(w.DWORD)]
u.GetWindowThreadProcessId.restype=w.DWORD
u.AttachThreadInput.argtypes=[w.DWORD,w.DWORD,w.BOOL]
u.GetWindowPlacement.argtypes=[w.HWND,c.POINTER(Placement)]
u.SetWindowPlacement.argtypes=[w.HWND,c.POINTER(Placement)]
k.GetCurrentThreadId.restype=w.DWORD

def excel_windows():
    found=[]
    @CALLBACK
    def visit(hwnd,_):
        cls=c.create_unicode_buffer(256)
        title=c.create_unicode_buffer(1024)
        u.GetClassNameW(hwnd,cls,256)
        u.GetWindowTextW(hwnd,title,1024)
        if u.IsWindowVisible(hwnd) and cls.value=='XLMAIN': found.append((hwnd,title.value))
        return True
    u.EnumWindows(visit,0)
    return found

def activate(hwnd):
    if not hwnd or not u.IsWindow(hwnd): return False
    current=k.GetCurrentThreadId()
    foreground=u.GetForegroundWindow()
    thread=u.GetWindowThreadProcessId(foreground,None) if foreground else 0
    attached=bool(thread and thread!=current and u.AttachThreadInput(current,thread,True))
    try:
        u.SetForegroundWindow(hwnd)
    finally:
        if attached: u.AttachThreadInput(current,thread,False)
    return u.GetForegroundWindow()==hwnd

class Switcher:
    def __init__(self):
        self.target=None
        self.previous=None
        self.placement=None
        self.covered=False
    def show(self):
        if self.covered: return True
        if not self.target or self.target not in [h for h,_ in excel_windows()]: return False
        self.previous=u.GetForegroundWindow()
        self.placement=Placement()
        self.placement.length=c.sizeof(Placement)
        if not u.GetWindowPlacement(self.target,c.byref(self.placement)): self.placement=None
        u.ShowWindow(self.target,3)  # maximize the selected workbook
        self.covered=True
        return activate(self.target)
    def restore(self):
        if not self.covered: return
        # Never steal focus back if the user deliberately selected another application.
        still_excel=u.GetForegroundWindow()==self.target
        if self.placement is not None and u.IsWindow(self.target): u.SetWindowPlacement(self.target,c.byref(self.placement))
        if still_excel and self.previous and self.previous!=self.target: activate(self.previous)
        self.covered=False
        self.previous=None
