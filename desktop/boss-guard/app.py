"""Local camera -> MediaPipe -> selected Excel -> previous window. No uploads."""
import hashlib
import os
from pathlib import Path
import queue
import threading
import time
import tkinter as tk
from tkinter import ttk, messagebox
import urllib.request
import cv2
import mediapipe as mp
from PIL import Image, ImageTk
from tracker import Guard
from windows import Switcher, excel_windows

ROOT=Path(__file__).resolve().parent
MODEL_URL='https://letitia.sherw2012.chatgpt.site/models/efficientdet-lite0.tflite'
MODEL_FALLBACK='https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite'

class App:
    def __init__(self,root):
        self.root=root
        self.guard=Guard()
        self.switcher=Switcher()
        self.messages=queue.Queue(maxsize=2)
        self.stop_event=threading.Event()
        self.thread=None
        self.people=[]
        self.armed=False
        self.running=False
        self.dead=False
        self.last_frame=0
        self.status=tk.StringVar(value='先打开 Excel 工作簿，再开启摄像头。')
        self.camera=tk.IntVar(value=0)
        self.sensitivity=tk.StringVar(value='标准')
        self.delay=tk.IntVar(value=3)
        root.title('LETITIA · 打工人保命系统')
        root.geometry('760x860')
        root.configure(bg='#f5f6f0')
        ttk.Label(root,text='身后有人？上班。',font=('Microsoft YaHei',23,'bold')).pack(pady=12)
        ttk.Label(root,text='本地人体检测 · 不上传画面 · 不调用 Kimi').pack()
        self.canvas=tk.Canvas(root,width=640,height=480,bg='#161c17',highlightthickness=0)
        self.canvas.pack(pady=10)
        self.canvas.bind('<Button-1>',self.choose)
        controls=ttk.Frame(root)
        controls.pack(fill='x',padx=25)
        ttk.Label(controls,text='摄像头编号').grid(row=0,column=0)
        self.camera_control=ttk.Spinbox(controls,from_=0,to=5,textvariable=self.camera,width=3)
        self.camera_control.grid(row=0,column=1,padx=6)
        self.start_button=ttk.Button(controls,text='开启摄像头',command=self.start)
        self.start_button.grid(row=0,column=2,padx=6)
        ttk.Button(controls,text='关闭摄像头',command=self.stop).grid(row=0,column=3,padx=6)
        self.sensitivity_control=ttk.Combobox(controls,textvariable=self.sensitivity,values=['高','标准','低'],state='readonly',width=6)
        self.sensitivity_control.grid(row=0,column=4,padx=6)
        ttk.Label(controls,text='恢复等待 / 秒').grid(row=0,column=5)
        ttk.Spinbox(controls,from_=2,to=10,textvariable=self.delay,width=3).grid(row=0,column=6)
        self.windows=ttk.Combobox(root,state='readonly',width=65)
        self.windows.pack(pady=8)
        actions=ttk.Frame(root)
        actions.pack()
        ttk.Button(actions,text='刷新 Excel 列表',command=self.refresh).pack(side='left',padx=5)
        ttk.Button(actions,text='测试切换（3 秒后恢复）',command=self.test_switch).pack(side='left',padx=5)
        ttk.Button(actions,text='开始守卫',command=self.arm).pack(side='left',padx=5)
        ttk.Button(actions,text='停止守卫',command=self.disarm).pack(side='left',padx=5)
        ttk.Label(root,textvariable=self.status,wraplength=710,font=('Microsoft YaHei',11)).pack(padx=20,pady=12)
        ttk.Label(root,text='点击自己的绿色候选框完成标记。守卫开启后可最小化此窗口。\n摄像头断开或本人跟踪丢失时保留 Excel，停止守卫后重新标记。',wraplength=710).pack()
        root.protocol('WM_DELETE_WINDOW',self.close)
        self.refresh()
        root.after(60,self.poll)

    def refresh(self):
        self.targets=excel_windows()
        self.windows['values']=[title for _,title in self.targets]
        if self.targets: self.windows.current(0)
    def target(self):
        i=self.windows.current()
        if i<0 or i>=len(self.targets):
            messagebox.showinfo('先选择 Excel','请打开 Excel 工作簿，再刷新列表并选择窗口。')
            return False
        self.switcher.target=self.targets[i][0]
        return True
    def test_switch(self):
        if self.armed or self.switcher.covered: return
        if self.target():
            ok=self.switcher.show()
            self.status.set('测试切换成功。' if ok else 'Windows 阻止了前台切换，请先点击 Excel，再重试。')
            self.root.after(3000,lambda:self.switcher.restore() if not self.armed else None)
    def send(self,item):
        try: self.messages.put_nowait(item)
        except queue.Full:
            try: self.messages.get_nowait()
            except queue.Empty: pass
            self.messages.put_nowait(item)
    def capture(self,index):
        cap=None
        detector=None
        try:
            model=ROOT/'efficientdet-lite0.tflite'
            expected=(ROOT/'model.sha256').read_text().strip()
            if not model.exists() or hashlib.sha256(model.read_bytes()).hexdigest()!=expected:
                self.send(('status','首次启动正在下载模型…'))
                data=None
                for url in [MODEL_URL,MODEL_FALLBACK]:
                    try:
                        with urllib.request.urlopen(url,timeout=45) as response: candidate=response.read(6000000)
                        if hashlib.sha256(candidate).hexdigest()!=expected: raise ValueError('模型校验失败')
                        data=candidate
                        break
                    except Exception:
                        if self.stop_event.is_set(): return
                if data is None: raise RuntimeError('模型下载失败，请检查网络后重试。')
                model.write_bytes(data)
            if self.stop_event.is_set(): return
            options=mp.tasks.vision.ObjectDetectorOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(model)),running_mode=mp.tasks.vision.RunningMode.VIDEO,max_results=8,score_threshold=.25,category_allowlist=['person'])
            detector=mp.tasks.vision.ObjectDetector.create_from_options(options)
            cap=cv2.VideoCapture(index,cv2.CAP_DSHOW)
            cap.set(cv2.CAP_PROP_FRAME_WIDTH,640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT,480)
            if not cap.isOpened(): raise RuntimeError('摄像头无法打开，请检查权限、编号或是否被其他软件占用。')
            while not self.stop_event.is_set():
                success,frame=cap.read()
                if not success: raise RuntimeError('摄像头已断开。')
                # A fixed frame size keeps selection and detection coordinates consistent.
                frame=cv2.resize(frame,(640,480))
                rgb=cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)
                now=time.monotonic()
                result=detector.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB,data=rgb),int(now*1000))
                people=[dict(x=d.bounding_box.origin_x/640,y=d.bounding_box.origin_y/480,w=d.bounding_box.width/640,h=d.bounding_box.height/480,score=d.categories[0].score) for d in result.detections]
                self.send(('frame',rgb,people,now))
                self.stop_event.wait(.08)
        except Exception as exc:
            if not self.stop_event.is_set(): self.send(('error',str(exc)))
        finally:
            if cap is not None: cap.release()
            if detector is not None: detector.close()
    def start(self):
        if self.thread is not None and self.thread.is_alive(): return
        self.disarm()
        while not self.messages.empty(): self.messages.get_nowait()
        self.people=[]
        self.last_frame=0
        self.stop_event.clear()
        self.running=True
        self.status.set('正在启动摄像头与模型…')
        self.start_button.configure(state='disabled')
        self.camera_control.configure(state='disabled')
        self.thread=threading.Thread(target=self.capture,args=(self.camera.get(),),daemon=True)
        self.thread.start()
    def choose(self,event):
        if self.armed: return
        x=1-event.x/640
        y=event.y/480
        candidates=[p for p in self.people if p['x']<=x<=p['x']+p['w'] and p['y']<=y<=p['y']+p['h']]
        if candidates:
            self.guard.calibrate(min(candidates,key=lambda p:p['w']*p['h']),time.monotonic())
            self.status.set('已标记你。确认绿色框正确后，点击开始守卫。')
    def arm(self):
        if self.switcher.covered: return
        if not self.running or time.monotonic()-self.last_frame>2 or self.guard.owner is None or self.guard.lost:
            messagebox.showinfo('先标记自己','请开启摄像头并点击自己的检测框。')
            return
        if self.target():
            self.armed=True
            self.guard.cover=False
            self.guard.suspect=None
            self.guard.hits=0
            self.windows.configure(state='disabled')
            self.status.set('守卫中。现在可以最小化此窗口，正常使用电脑。')
    def disarm(self):
        self.armed=False
        self.guard.reset()
        self.switcher.restore()
        self.windows.configure(state='readonly')
        self.status.set('守卫已停止。再次开启前请重新标记自己。')
    def stop(self):
        self.disarm()
        self.stop_event.set()
        self.running=False
        self.people=[]
        self.start_button.configure(state='normal')
        self.camera_control.configure(state='normal')
        self.status.set('摄像头正在关闭。')
    def poll(self):
        if self.dead: return
        try:
            while True:
                item=self.messages.get_nowait()
                if not self.running: continue
                if item[0]=='status': self.status.set(item[1])
                elif item[0]=='error':
                    if self.armed: self.switcher.show()
                    self.armed=False
                    self.running=False
                    self.status.set('已停止：'+item[1]+' 处理后重新开启。')
                    self.start_button.configure(state='normal')
                    self.camera_control.configure(state='normal')
                    self.guard.reset()
                elif item[0]=='frame':
                    _,rgb,raw,now=item
                    self.last_frame=now
                    threshold={'高':.35,'标准':.5,'低':.65}[self.sensitivity.get()]
                    self.people=[p for p in raw if p['score']>=threshold]
                    try: delay=max(2,min(10,self.delay.get()))
                    except (ValueError,tk.TclError): delay=3
                    own,covered,lost=self.guard.update(self.people,now,delay)
                    if self.armed:
                        if covered and not self.switcher.covered:
                            if not self.switcher.show():
                                self.status.set('切换失败：确认 Excel 仍打开，且没有权限级别差异。停止守卫后重试。')
                                self.armed=False
                                self.root.bell()
                            else: self.status.set('已切到 Excel，等待其他人离开。')
                        elif not covered and self.switcher.covered:
                            self.switcher.restore()
                            self.status.set('其他人已离开，已尝试恢复原窗口。')
                        if lost: self.status.set('本人跟踪丢失，保留 Excel。停止守卫后重新标记。')
                    image=Image.fromarray(rgb).transpose(Image.Transpose.FLIP_LEFT_RIGHT)
                    self.photo=ImageTk.PhotoImage(image)
                    self.canvas.delete('all')
                    self.canvas.create_image(0,0,image=self.photo,anchor='nw')
                    for i,p in enumerate(self.people):
                        x=(1-p['x']-p['w'])*640
                        y=p['y']*480
                        color='#6cff89' if i==own else '#f0fa43'
                        self.canvas.create_rectangle(x,y,x+p['w']*640,y+p['h']*480,outline=color,width=3)
                        self.canvas.create_text(x+5,y+14,text=f"{'ME' if i==own else 'PERSON'} {p['score']:.0%}",fill=color,anchor='w')
        except queue.Empty: pass
        if self.armed and time.monotonic()-self.last_frame>5:
            self.switcher.show()
            self.armed=False
            self.guard.reset()
            self.status.set('超过 5 秒没有新画面，守卫已停止并尝试切到 Excel。请重新启动摄像头。')
        self.root.after(60,self.poll)
    def close(self):
        self.dead=True
        self.stop()
        self.root.destroy()

if __name__=='__main__':
    root=tk.Tk()
    App(root)
    root.mainloop()
