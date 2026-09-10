import { Guard } from './tracker.js';
const stylesheet=new URL('./style.css',import.meta.url).href;
export function mount(container){
  if(!document.querySelector('link[data-boss-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href=stylesheet;link.dataset.bossStyle='';document.head.append(link);}
  container.innerHTML=`<section class="bg">
    <div class="bg-intro"><div><p class="bg-tag">LETITIA / EXPERIMENT 002</p><h3>身后有人？上班。</h3><p>摄像头哨兵 · 人走了，再切回来。</p></div><span class="bg-badge">本地识别 · 不消耗 API</span></div>
    <div class="bg-layout"><div>
      <div class="bg-camera"><video muted autoplay playsinline aria-label="摄像头预览"></video><canvas aria-label="人物检测框，点击自己的框进行标记"></canvas><div class="bg-camera-empty"><strong>先看看你的身后</strong><span>开启摄像头后，点击自己的检测框。</span></div></div>
      <div class="bg-readout"><span class="bg-count">检测人数 —</span><span class="bg-speed">摄像头未开启</span></div>
      <p class="bg-status" role="status" aria-live="polite">01 / 开启摄像头</p><div class="bg-owner-choices" aria-label="选择哪个人是自己"></div><p class="bg-error" role="alert" hidden></p>
    </div><div class="bg-controls">
      <button type="button" class="bg-primary bg-start">开启摄像头</button>
      <label>摄像头<select class="bg-device"><option value="">默认摄像头</option></select></label>
      <label>检测灵敏度<select class="bg-sensitivity"><option value="0.35">高 · 更容易触发</option><option value="0.5" selected>标准</option><option value="0.65">低 · 减少误触发</option></select></label>
      <label>无人后的恢复等待<select class="bg-delay"><option value="2000">2 秒</option><option value="3000" selected>3 秒</option><option value="5000">5 秒</option></select></label>
      <button type="button" class="bg-primary bg-arm" disabled>标记自己后，开始守卫</button>
      <div class="bg-actions"><button type="button" class="bg-test">预览工作表</button><button type="button" class="bg-stop" disabled>关闭摄像头</button></div>
      <div class="bg-help"><p>先独自坐好，点击画面中自己的框；也可用画面下方的按钮选择。绿色是你，黄色是其他人。</p><p>网页版会覆盖<strong>当前网页</strong>，显示 Excel 风格工作表。请保持此页在前台；它无法切换其他软件。</p><p>只检测摄像头看得到的人；完全遮挡会漏检。本人跟踪丢失时保留工作表，需重新标记。</p><p>画面不上传、不保存。首次启动需下载识别模型。</p></div>
    </div></div>
    <div class="bg-desktop"><strong>要切换电脑上的真实 Excel？</strong><br><a href="/downloads/letitia-boss-guard-windows.zip" download>下载 Windows 本地版 ↓</a><small>需要 Windows 10/11、64 位 Python 3.11 和已安装的 Excel。解压后双击 start.bat；首次安装依赖需要联网。打开你的工作簿，选择 Excel 窗口，再开启守卫。此版本需在你的电脑上验证摄像头与窗口切换。</small></div>
    <div class="bg-sheet" hidden role="region" aria-label="Excel 风格工作表预览">
      <div class="bg-sheet-top"><span>季度经营分析.xlsx — Excel</span><span>自动保存</span></div><div class="bg-sheet-tabs">文件　开始　插入　页面布局　公式　数据　审阅　视图</div>
      <div class="bg-sheet-ribbon"><span>粘贴　剪切　复制</span><span>等线　11　　B　I　U</span><span>对齐方式　自动换行</span><span>条件格式　筛选　∑ 自动求和</span></div>
      <div class="bg-sheet-formula"><span>D8</span><span>ƒx</span><span>=SUM(D3:D7)</span></div><div class="bg-sheet-grid"><table aria-label="季度经营分析表"></table></div>
      <div class="bg-sheet-bottom"><span>就绪　｜　经营总览　＋</span><span class="bg-sheet-footer-note">工作表预览 · 非 Microsoft Excel</span><button type="button" class="bg-uncover">退出守卫</button></div>
    </div>
  </section>`;
  const $=s=>container.querySelector(s),root=$('.bg'),video=$('video'),canvas=$('canvas'),ctx=canvas.getContext('2d'),sheet=$('.bg-sheet');
  const guard=new Guard(),events=new AbortController();
  let disposed=false,stream=null,worker=null,timer=null,watchdog=null,busy=false,running=false,armed=false,ready=false,epoch=0,people=[],selected=null,previousVideoTime=-1,lastResult=0,previewTimer=null,wasCovered=false;
  const listen=(el,event,fn)=>el.addEventListener(event,fn,{signal:events.signal});
  const status=text=>{if($('.bg-status').textContent!==text)$('.bg-status').textContent=text;};
  const error=text=>{$('.bg-error').textContent=text;$('.bg-error').hidden=!text;};
  let focusBeforeCover=null;
  function cover(show){if(show&&!wasCovered)focusBeforeCover=document.activeElement;sheet.hidden=!show;wasCovered=show;if(show) $('.bg-uncover').focus({preventScroll:true});else if(focusBeforeCover?.isConnected){focusBeforeCover.focus({preventScroll:true});focusBeforeCover=null;}}
  function draw(result){
    canvas.width=video.videoWidth||640;canvas.height=video.videoHeight||480;ctx.clearRect(0,0,canvas.width,canvas.height);
    result.people.forEach((p,i)=>{const own=i===result.ownerIndex;ctx.strokeStyle=own?'#67ff85':'#fff347';ctx.lineWidth=3;ctx.strokeRect(p.x*canvas.width,p.y*canvas.height,p.w*canvas.width,p.h*canvas.height);});
    $('.bg-count').textContent=`检测人数 ${result.people.length}${armed?` · 其他人 ${result.other??0}`:''}`;
  }
  function choose(index){if(armed||!people[index])return;selected={...people[index]};guard.calibrate(selected,performance.now());$('.bg-arm').disabled=false;status('02 / 已标记你。确认绿色框正确，再开始守卫。');draw({people,ownerIndex:index});}
  function stop(){
    epoch++;running=false;ready=false;armed=false;busy=false;clearTimeout(timer);clearInterval(watchdog);clearTimeout(previewTimer);worker?.terminate();worker=null;
    stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;guard.reset();selected=null;people=[];cover(false);ctx.clearRect(0,0,canvas.width,canvas.height);
    $('.bg-start').disabled=false;$('.bg-start').textContent='开启摄像头';$('.bg-stop').disabled=true;$('.bg-arm').disabled=true;$('.bg-arm').textContent='标记自己后，开始守卫';$('.bg-device').disabled=false;$('.bg-owner-choices').replaceChildren();$('.bg-camera-empty').hidden=false;$('.bg-count').textContent='检测人数 —';$('.bg-speed').textContent='摄像头已关闭';status('摄像头已关闭');
  }
  function fail(message){const hadCover=armed||wasCovered;stop();if(hadCover)cover(true);error(message);status('守卫已停止，请处理提示后重新开启。');}
  async function frame(){
    if(!running||!ready||busy||disposed)return;
    if(video.readyState<2||video.currentTime===previousVideoTime){timer=setTimeout(frame,100);return;}
    const current=epoch;busy=true;previousVideoTime=video.currentTime;
    try{const bitmap=await createImageBitmap(video,{resizeWidth:640,resizeHeight:Math.round(640*video.videoHeight/video.videoWidth)});if(current!==epoch||!worker){bitmap.close();return;}worker.postMessage({type:'frame',bitmap,now:performance.now()},[bitmap]);}
    catch(e){if(current===epoch)fail('无法读取摄像头画面，请关闭其他占用摄像头的软件后重试。');}
  }
  async function start(){
    stop();error('');const current=epoch;
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
      watchdog=setInterval(()=>{if(!running)return;const elapsed=performance.now()-(ready?lastResult:loadStarted);if(elapsed>(ready?10000:90000))fail(ready?'画面或识别已中断，守卫停止。请保持页面在前台后重试。':'模型下载超时，请检查网络后重试。');},1000);
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
          if(result.cover!==wasCovered)cover(result.cover);
          status(result.state==='lost'?'本人跟踪丢失，工作表保持遮盖。退出守卫后重新标记。':result.cover?'03 / 已切换工作表，等待其他人离开。':result.other?'有人出现，正在确认…':'03 / 守卫中，暂未检测到其他人。');
        }
        timer=setTimeout(frame,100);
      };worker.postMessage({type:'init'});
    }catch(e){if(current!==epoch||disposed)return;stop();const messages={NotAllowedError:'摄像头权限被拒绝，请在浏览器地址栏的网站权限中允许摄像头。',NotFoundError:'未找到摄像头，请连接摄像头后重试。',NotReadableError:'摄像头被其他软件占用，请关闭占用后重试。'};error(messages[e.name]||'摄像头启动失败，请在电脑 Chrome / Edge 中重试。');}
  }
  listen($('.bg-start'),'click',start);listen($('.bg-stop'),'click',stop);
  listen(canvas,'click',event=>{const r=canvas.getBoundingClientRect(),x=1-(event.clientX-r.left)/r.width,y=(event.clientY-r.top)/r.height;const hits=people.map((p,i)=>({p,i})).filter(({p})=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h).sort((a,b)=>a.p.w*a.p.h-b.p.w*b.p.h);if(hits.length)choose(hits[0].i);});
  listen($('.bg-arm'),'click',()=>{if(!ready||!guard.owner||guard.lost)return;clearTimeout(previewTimer);cover(false);armed=true;guard.cover=false;guard.suspectAt=null;guard.hits=0;$('.bg-arm').disabled=true;$('.bg-arm').textContent='正在守卫';$('.bg-owner-choices').replaceChildren();status('03 / 守卫中，暂未检测到其他人。');});
  listen($('.bg-sensitivity'),'change',event=>{guard.threshold=Number(event.target.value);});listen($('.bg-delay'),'change',event=>{guard.clearMs=Number(event.target.value);});
  listen($('.bg-test'),'click',()=>{clearTimeout(previewTimer);cover(true);previewTimer=setTimeout(()=>{if(!armed)cover(false);},5000);});
  listen($('.bg-uncover'),'click',()=>{armed=false;guard.reset();selected=null;clearTimeout(previewTimer);cover(false);$('.bg-arm').disabled=true;$('.bg-arm').textContent='标记自己后，开始守卫';status(running?'请重新标记自己，再开始守卫。':'摄像头未开启');});
  listen(document,'visibilitychange',()=>{if(armed&&document.hidden){cover(true);guard.cover=true;status('页面进入后台，检测可能暂停。返回后确认画面正常。');}});
  listen(window,'pagehide',stop);
  const table=$('.bg-sheet table');const head=table.createTHead().insertRow();['','A','B','C','D','E','F','G','H'].forEach(t=>{const th=document.createElement('th');th.textContent=t;head.append(th);});const body=table.createTBody();
  const rows=[['季度经营分析','','','','','','',''],['部门','项目','预算（元）','实际（元）','执行率','差额（元）','负责人','状态'],...['市场','产品','运营','研发','行政'].map((d,i)=>[d,'季度费用',String(68000+i*12000),String(62000+i*11000),'91.2%',String(6000+i*1000),['王','李','张','陈','周'][i],'已复核']),['合计','','460000','420000','91.3%','40000','',''],['','','','','','','',''],['备注','按月更新，数据待最终复核','','','','','','']];
  for(let i=0;i<36;i++){const tr=body.insertRow();const th=document.createElement('th');th.className='bg-row-num';th.textContent=String(i+1);tr.append(th);for(let j=0;j<8;j++){const td=tr.insertCell();td.textContent=rows[i]?.[j]||'';if(i===1)td.className='bg-cell-heading';if(i===7&&j===3)td.className='bg-active-cell';}}
  return ()=>{disposed=true;stop();events.abort();root.remove();};
}
