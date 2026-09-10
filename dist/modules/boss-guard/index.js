import { Guard } from './tracker.js';
import { DEFAULT_DESTINATION, destination } from './destination.js';
import { BrowseWindow } from './browse-window.js';
const stylesheet=new URL('./style.css',import.meta.url).href;
export function mount(container){
  if(!document.querySelector('link[data-boss-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href=stylesheet;link.dataset.bossStyle='';document.head.append(link);}
  container.innerHTML=`<section class="bg">
    <div class="bg-intro"><div><p class="bg-tag">LETITIA / EXPERIMENT 002</p><h3>身后有人？上班。</h3><p>这个窗口负责盯梢，另一个窗口负责切网页。</p></div><span class="bg-badge">本地识别 · 不消耗 API</span></div>
    <div class="bg-layout"><div>
      <div class="bg-camera"><video muted autoplay playsinline aria-label="摄像头预览"></video><canvas aria-label="人物检测框，点击自己的框进行标记"></canvas><div class="bg-camera-empty"><strong>先看看你的身后</strong><span>开启摄像头后，点击自己的检测框。</span></div></div>
      <div class="bg-readout"><span class="bg-count">检测人数 —</span><span class="bg-speed">摄像头未开启</span></div>
      <p class="bg-status" role="status" aria-live="polite">01 / 开启摄像头</p><div class="bg-owner-choices" aria-label="选择哪个人是自己"></div><p class="bg-error" role="alert" hidden></p>
    </div><div class="bg-controls">
      <button type="button" class="bg-primary bg-start">开启摄像头</button>
      <label>摄像头<select class="bg-device"><option value="">默认摄像头</option></select></label>
      <label>检测灵敏度<select class="bg-sensitivity"><option value="0.35">高 · 更容易触发</option><option value="0.5" selected>标准</option><option value="0.65">低 · 减少误触发</option></select></label>
      <label for="bg-url">有人时跳转到<input id="bg-url" class="bg-url" type="url" maxlength="2048" inputmode="url" autocomplete="url" spellcheck="false" placeholder="https://scholar.google.com/" aria-describedby="bg-url-hint"></label><p id="bg-url-hint" class="bg-help">默认 Google 学术。网址仅保存在当前浏览器，可改为你能正常访问的网页。</p>
      <label for="bg-browse">平时浏览 / 无人时恢复到<input id="bg-browse" class="bg-url" type="url" maxlength="2048" inputmode="url" autocomplete="url" spellcheck="false"></label>
      <label>无人后的恢复等待<select class="bg-delay"><option value="2000">2 秒</option><option value="3000" selected>3 秒</option><option value="5000">5 秒</option></select></label>
      <button type="button" class="bg-primary bg-arm" disabled>标记自己后，打开浏览窗口并守卫</button>
      <div class="bg-actions"><button type="button" class="bg-test">检查目标网页</button><button type="button" class="bg-stop" disabled>关闭摄像头</button></div>
      <div class="bg-help"><p>先独自坐好，点击自己的检测框，再开始守卫。会打开<strong>独立浏览窗口</strong>，请在那个窗口浏览网页。</p><p><strong>切到 Google 学术后，这里的摄像头继续检测。</strong>人离开后，浏览窗口重新打开你设置的恢复网址，不保留第三方网页的滚动或表单状态。</p><p>保留守卫窗口，不要关闭或最小化；最好把两个窗口并排放置。浏览器省电或后台节流可能延迟检测。此功能不能控制你另外打开的标签页。</p><p>部分网站会切断窗口控制，届时会提示重新打开；请先用“检查目标网页”验证。目标网页是否能打开取决于你的网络。</p><p>完全遮挡会漏检；本人跟踪丢失也会触发跳转。画面不上传、不保存，不需本地程序。</p></div>
    </div></div>
  </section>`;
  const $=s=>container.querySelector(s),root=$('.bg'),video=$('video'),canvas=$('canvas'),ctx=canvas.getContext('2d');
  const guard=new Guard(),events=new AbortController(),browse=new BrowseWindow((...args)=>window.open(...args));
  let disposed=false,stream=null,worker=null,timer=null,watchdog=null,busy=false,running=false,armed=false,ready=false,epoch=0,people=[],selected=null,previousVideoTime=-1,lastResult=0,lastSwitchMessage='';
  const listen=(el,event,fn)=>el.addEventListener(event,fn,{signal:events.signal});
  const status=text=>{if($('.bg-status').textContent!==text)$('.bg-status').textContent=text;};
  const error=text=>{$('.bg-error').textContent=text;$('.bg-error').hidden=!text;};
  try{$('.bg-url').value=destination(localStorage.getItem('letitia.guard.destination'));}catch{$('.bg-url').value=DEFAULT_DESTINATION;}
  function readDestination(){
    try{const value=destination($('.bg-url').value);$('.bg-url').value=value;try{localStorage.setItem('letitia.guard.destination',value);}catch{} error('');return value;}
    catch(e){error(e.message);$('.bg-url').focus();return null;}
  }
  try{$('#bg-browse').value=destination(localStorage.getItem('letitia.guard.browse')||window.location.origin+'/');}catch{$('#bg-browse').value=window.location.origin+'/';}
  function readBrowse(){try{const value=destination($('#bg-browse').value||window.location.origin+'/');$('#bg-browse').value=value;try{localStorage.setItem('letitia.guard.browse',value);}catch{}return value;}catch(e){error(e.message);$('#bg-browse').focus();return null;}}
  function unlock(){armed=false;$('.bg-url').disabled=false;$('#bg-browse').disabled=false;$('.bg-arm').disabled=!ready||!guard.owner||guard.lost;$('.bg-arm').textContent='重新打开浏览窗口并守卫';}
  function switchBrowse(covered){try{const changed=browse.switch(covered);if(changed)lastSwitchMessage=covered?'已请求打开目标网页；摄像头仍在检测。':'其他人已离开，已请求恢复日常网页。';return true;}catch(e){unlock();error(e.message);status('摄像头继续检测，浏览窗口控制已中断。');return false;}}
  function draw(result){
    canvas.width=video.videoWidth||640;canvas.height=video.videoHeight||480;ctx.clearRect(0,0,canvas.width,canvas.height);
    result.people.forEach((p,i)=>{const own=i===result.ownerIndex;ctx.strokeStyle=own?'#67ff85':'#fff347';ctx.lineWidth=3;ctx.strokeRect(p.x*canvas.width,p.y*canvas.height,p.w*canvas.width,p.h*canvas.height);});
    $('.bg-count').textContent=`检测人数 ${result.people.length}${armed?` · 其他人 ${result.other??0}`:''}`;
  }
  function choose(index){if(armed||!people[index])return;selected={...people[index]};guard.calibrate(selected,performance.now());$('.bg-arm').disabled=false;status('02 / 已标记你。确认绿色框正确，再开始守卫。');draw({people,ownerIndex:index});}
  function stop(){
    epoch++;running=false;ready=false;armed=false;busy=false;clearTimeout(timer);clearInterval(watchdog);worker?.terminate();worker=null;
    stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;guard.reset();selected=null;people=[];ctx.clearRect(0,0,canvas.width,canvas.height);
    $('.bg-start').disabled=false;$('.bg-start').textContent='开启摄像头';$('.bg-stop').disabled=true;$('.bg-arm').disabled=true;$('.bg-arm').textContent='标记自己后，打开浏览窗口并守卫';$('.bg-device').disabled=false;$('.bg-url').disabled=false;$('#bg-browse').disabled=false;$('.bg-owner-choices').replaceChildren();$('.bg-camera-empty').hidden=false;$('.bg-count').textContent='检测人数 —';$('.bg-speed').textContent='摄像头已关闭';status('摄像头已关闭');
  }
  function fail(message){stop();error(message);status('守卫已停止，请处理提示后重新开启。');}
  async function frame(){
    if(!running||!ready||busy||disposed)return;
    if(video.readyState<2||video.currentTime===previousVideoTime){timer=setTimeout(frame,100);return;}
    const current=epoch;busy=true;previousVideoTime=video.currentTime;
    try{const bitmap=await createImageBitmap(video,{resizeWidth:640,resizeHeight:Math.round(640*video.videoHeight/video.videoWidth)});if(current!==epoch||!worker){bitmap.close();return;}worker.postMessage({type:'frame',bitmap,now:performance.now()},[bitmap]);}
    catch(e){if(current===epoch)fail('无法读取摄像头画面，请关闭其他占用摄像头的软件后重试。');}
  }
  async function start(){
    stop();previousVideoTime=-1;error('');const current=epoch;
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){error('此浏览器无法使用摄像头，请在电脑 Chrome / Edge 中打开 HTTPS 网站。');return;}
    $('.bg-start').disabled=true;$('.bg-start').textContent='正在请求摄像头…';status('请允许摄像头访问。');
    try{
      const id=$('.bg-device').value;
      const media=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},...(id?{deviceId:{exact:id}}:{facingMode:'user'})},audio:false});
      if(disposed||current!==epoch){media.getTracks().forEach(t=>t.stop());return;}
      stream=media;video.srcObject=media;await video.play();if(disposed||current!==epoch)return;
      running=true;$('.bg-stop').disabled=false;$('.bg-device').disabled=true;$('.bg-camera-empty').hidden=true;status('正在加载本地识别模型，首次启动稍慢…');$('.bg-start').textContent='正在加载模型…';
      const devices=await navigator.mediaDevices.enumerateDevices();if(disposed||current!==epoch)return;
      const device=$('.bg-device');device.replaceChildren();devices.filter(d=>d.kind==='videoinput').forEach((d,i)=>{const option=document.createElement('option');option.value=d.deviceId;option.textContent=d.label||`摄像头 ${i+1}`;device.append(option);});device.value=media.getVideoTracks()[0].getSettings().deviceId||'';
      media.getVideoTracks()[0].addEventListener('ended',()=>{if(current===epoch&&!disposed)fail('摄像头已断开，请重新连接。');},{signal:events.signal});
      // Classic worker permits MediaPipe's WASM loader to use importScripts.
      worker=new Worker(new URL('./detector-worker.js',import.meta.url));
      worker.onerror=()=>{if(current===epoch)fail('识别组件加载失败，请检查网络后重试。');};
      const loadStarted=performance.now();lastResult=loadStarted;
      watchdog=setInterval(()=>{if(!running)return;const elapsed=performance.now()-(ready?lastResult:loadStarted);if(!ready&&elapsed>90000){fail('模型下载超时，请检查网络后重试。');return;}if(ready&&elapsed>5000)status('检测画面更新变慢或暂停，请让守卫窗口保持可见。摄像头仍开启。');if(armed&&!browse.available()){unlock();error('浏览窗口已关闭或目标网站隔离了控制。摄像头仍开启，请重新打开浏览窗口。');}},1000);
      worker.onmessage=({data})=>{
        if(current!==epoch||disposed)return;
        if(data.type==='error'){fail('识别引擎启动或运行失败，请关闭摄像头后重试。');return;}
        if(data.type==='ready'){ready=true;lastResult=performance.now();$('.bg-start').textContent='摄像头已开启';status('02 / 点击画面里自己的框，或选择下方人物编号。');frame();return;}
        if(data.type!=='result')return;
        busy=false;lastResult=performance.now();people=data.people.filter(p=>p.score>=guard.threshold);
        const result=guard.update(people,lastResult);draw(result);
        $('.bg-speed').textContent=`本地推理 ${Math.round(lastResult-data.now)} ms`;
        if(!armed){
          const choices=$('.bg-owner-choices');choices.replaceChildren();people.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.textContent=`我是人物 ${i+1}（${Math.round((1-p.x-p.w/2)*100)}% 横向位置）`;b.onclick=()=>choose(i);choices.append(b);});
          if(guard.lost){selected=null;guard.reset();$('.bg-arm').disabled=true;status('跟踪丢失，请重新标记自己。');}
        }else{
          if(switchBrowse(result.cover))status(result.state==='lost'?'本人跟踪丢失，保持目标网页。关闭摄像头后重新标记。':result.cover?'目标网页显示中，摄像头持续检测。':result.other?'有人出现，正在确认…':lastSwitchMessage||'03 / 守卫中，请在独立浏览窗口浏览。');
        }
        timer=setTimeout(frame,100);
      };worker.postMessage({type:'init'});
    }catch(e){if(current!==epoch||disposed)return;stop();const messages={NotAllowedError:'摄像头权限被拒绝，请在浏览器地址栏的网站权限中允许摄像头。',NotFoundError:'未找到摄像头，请连接摄像头后重试。',NotReadableError:'摄像头被其他软件占用，请关闭占用后重试。'};error(messages[e.name]||'摄像头启动失败，请在电脑 Chrome / Edge 中重试。');}
  }
  listen($('.bg-start'),'click',start);listen($('.bg-stop'),'click',stop);
  listen(canvas,'click',event=>{const r=canvas.getBoundingClientRect(),x=1-(event.clientX-r.left)/r.width,y=(event.clientY-r.top)/r.height;const hits=people.map((p,i)=>({p,i})).filter(({p})=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h).sort((a,b)=>a.p.w*a.p.h-b.p.w*b.p.h);if(hits.length)choose(hits[0].i);});
  listen($('.bg-arm'),'click',()=>{
    if(!ready||!guard.owner||guard.lost)return;
    const target=readDestination(),initial=readBrowse();if(!target||!initial)return;
    if(target===initial){error('日常浏览网址和目标网址应不同，否则切换看不出变化。');return;}
    try{browse.start(initial,target);}catch(e){error(e.message);return;}
    error('');lastSwitchMessage='';armed=true;guard.cover=false;guard.suspectAt=null;guard.hits=0;$('.bg-url').disabled=true;$('#bg-browse').disabled=true;$('.bg-arm').disabled=true;$('.bg-arm').textContent='正在守卫';$('.bg-owner-choices').replaceChildren();status('03 / 摄像头持续检测，请在新开的浏览窗口浏览。');
  });
  listen($('.bg-sensitivity'),'change',event=>{guard.threshold=Number(event.target.value);});
  listen($('.bg-delay'),'change',event=>{guard.clearMs=Number(event.target.value);});
  listen($('.bg-url'),'change',readDestination);listen($('#bg-browse'),'change',readBrowse);
  listen($('.bg-test'),'click',()=>{const target=readDestination(),initial=readBrowse();if(!target||!initial)return;unlock();try{browse.start(initial,target);browse.switch(true);status('已请求打开目标网页；摄像头状态不变。确认可访问后返回这里开始守卫。');}catch(e){error(e.message);}});
  listen(document,'visibilitychange',()=>{if(armed&&document.hidden)status('守卫窗口被隐藏，检测可能变慢。请保持窗口可见。');});
  listen(window,'pagehide',stop);
  listen(window,'pageshow',event=>{if(event.persisted){stop();status('已返回。请重新开启摄像头并标记自己。');}});
  return ()=>{disposed=true;stop();events.abort();root.remove();};
}
