// Window navigation is separate from camera lifetime: this controller never stops media.
export class BrowseWindow {
  constructor(open){this.open=open;this.handle=null;this.covered=false;this.initial='';this.target='';}
  available(){try{return Boolean(this.handle&&!this.handle.closed);}catch{return false;}}
  start(initial,target){
    this.initial=initial;this.target=target;this.covered=false;
    if(!this.available())this.handle=this.open('about:blank','_blank','popup,width=1180,height=800');
    if(!this.handle)throw new Error('浏览窗口被拦截。请允许本站弹出窗口，再点击开始守卫。');
    try{this.handle.location=initial;}catch{throw new Error('浏览器阻止了窗口跳转，请关闭浏览窗口后重试。');}
    try{this.handle.focus();}catch{}
  }
  switch(covered){
    if(!this.available())throw new Error('浏览窗口已关闭，或目标网站隔离了窗口控制。摄像头仍开启；请重新打开浏览窗口。');
    if(this.covered===covered)return false;
    try{this.handle.location=covered?this.target:this.initial;}catch{throw new Error('浏览器阻止了窗口跳转。摄像头仍开启；请更换网址后重试。');}
    this.covered=covered;return true;
  }
}
