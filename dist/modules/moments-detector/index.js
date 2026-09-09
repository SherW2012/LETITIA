const stylesheet = new URL('./style.css', import.meta.url).href;

export function mount(container) {
  if (!document.querySelector('link[data-moments-style]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = stylesheet; link.dataset.momentsStyle = '';
    document.head.append(link);
  }
  container.innerHTML = `
    <section class="md" aria-label="朋友圈检测">
      <div class="md-intro"><span class="md-kicker">LETITIA / EXPERIMENT 001</span><p>发之前测一下。<br><strong>发之后，也来得及后悔。</strong></p></div>
      <div class="md-layout">
        <form class="md-form">
          <fieldset class="md-fields">
            <div class="md-label-row"><label for="md-file">01 / 放一张朋友圈截图</label><span>选填</span></div>
            <div class="md-drop">
              <input id="md-file" class="md-file" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="md-file-hint">
              <label class="md-upload-label" for="md-file"><span class="md-upload-symbol" aria-hidden="true">＋</span><strong>点击上传 / 拖入截图</strong><span id="md-file-hint">也可以在这里 Ctrl / ⌘ + V 粘贴<br>JPG、PNG、WebP · 最大 10 MB</span></label>
              <div class="md-preview" hidden><img class="md-preview-image" alt="待检测的朋友圈截图"><div class="md-preview-footer"><span class="md-filename"></span><button class="md-remove" type="button">移除截图 ×</button></div></div>
            </div>
            <div class="md-label-row md-text-label"><label for="md-text">02 / 粘贴文案</label><span class="md-char-count">0 / 5000</span></div>
            <textarea id="md-text" rows="5" maxlength="5000" placeholder="比如：好烦，又被升职了，以后陪家人的时间更少了……"></textarea>
            <p class="md-input-note">截图、文案任选其一，也可以一起提交。</p>
          </fieldset>
          <button class="md-submit" type="submit">开始锐评 <span aria-hidden="true">↗</span></button>
          <p class="md-status" role="status" aria-live="polite"></p>
          <p class="md-error" role="alert" hidden></p>
          <p class="md-privacy">点击检测后，内容将发送给 Kimi 分析。本站不保存上传内容。</p>
        </form>
        <div class="md-output" aria-label="检测报告">
          <div class="md-empty"><span class="md-report-tag">待出报告</span><h3>今天的朋友圈，<br>浓度有多高？</h3><div class="md-empty-metrics"><span>装逼指数</span><span>凡尔赛指数</span><span>AI 味指数</span><span>翻白眼指数</span></div><p>图一放，直接开涮。<br>分数纯属节目效果。</p></div>
          <div class="md-report" hidden tabindex="-1"></div>
        </div>
      </div>
      <p class="md-disclaimer">毒舌娱乐局：分数与吐槽纯属节目效果，不代表对真人的事实评价。</p>
    </section>`;
  const $ = (selector) => container.querySelector(selector);
  const form = $('.md-form'), fieldset = $('.md-fields'), input = $('#md-file'), textarea = $('#md-text');
  const drop = $('.md-drop'), upload = $('.md-upload-label'), preview = $('.md-preview');
  const previewImage = $('.md-preview-image'), status = $('.md-status'), error = $('.md-error');
  const submit = $('.md-submit'), report = $('.md-report'), empty = $('.md-empty');
  const listeners = new AbortController();
  let request = null, image = '', disposed = false, imageVersion = 0, preparing = false, busy = false;

  function showError(message) { error.textContent = message; error.hidden = !message; }
  function invalidate() { report.hidden = true; empty.hidden = false; showError(''); status.textContent = ''; }
  function updateButton() { submit.disabled = busy || preparing; }
  function resetImage() {
    imageVersion += 1; preparing = false; image = ''; input.value = ''; previewImage.removeAttribute('src');
    preview.hidden = true; upload.hidden = false; invalidate(); updateButton();
  }
  async function loadImage(file) {
    if (busy || !file) return;
    invalidate();
    const version = ++imageVersion;
    image = ''; preview.hidden = true; upload.hidden = false; previewImage.removeAttribute('src');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { preparing = false; updateButton(); showError('请上传 JPG、PNG 或 WebP 图片。'); return; }
    if (file.size > 10 * 1024 * 1024) { preparing = false; updateButton(); showError('这张图超过 10 MB，请裁出单条朋友圈后再试。'); return; }
    preparing = true; updateButton(); status.textContent = '正在准备截图…';
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      if (disposed || version !== imageVersion) return;
      if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 32_000_000) throw new Error('图片尺寸太大，请先裁出单条朋友圈。');
      const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      image = canvas.toDataURL('image/jpeg', 0.88);
      if (image.length > 4_600_000) image = canvas.toDataURL('image/jpeg', 0.7);
      if (image.length > 4_600_000) { image = ''; throw new Error('这张图仍然太大，请先裁出单条朋友圈。'); }
      previewImage.src = image; $('.md-filename').textContent = file.name || '粘贴的截图';
      preview.hidden = false; upload.hidden = true; status.textContent = '截图已准备好。';
    } catch (e) { if (!disposed && version === imageVersion) { image = ''; status.textContent = ''; showError(e.message.startsWith('图片') || e.message.startsWith('这张图') ? e.message : '图片没能打开，请换一张截图。'); } }
    finally { URL.revokeObjectURL(url); if (!disposed && version === imageVersion) { preparing = false; updateButton(); } }
  }

  function node(tag, className, text) { const el = document.createElement(tag); el.className = className; if (text !== undefined) el.textContent = text; return el; }
  function renderReport(data) {
    report.replaceChildren();
    const hero = node('div', 'md-verdict');
    hero.append(node('span', 'md-report-tag', '毒舌开麦 / 节目效果'), node('h3', '', data.summary), node('p', 'md-roast', data.roast));
    report.append(hero);
    const scores = node('div', 'md-scores');
    for (const [key, title] of [['flex', '装逼指数'], ['humblebrag', '凡尔赛指数'], ['ai', 'AI 味指数'], ['eyeroll', '翻白眼指数']]) {
      const item = data.metrics[key]; const card = node('section', 'md-score');
      const top = node('div', 'md-score-heading'); top.append(node('h4', '', title));
      const value = node('div', 'md-score-value'); value.append(node('strong', '', item.score === null ? '—' : String(item.score)), node('span', '', item.score === null ? '无法判断' : '/ 100'));
      top.append(value); card.append(top);
      if (item.score !== null) {
        const meter = document.createElement('meter'); meter.min = 0; meter.max = 100; meter.value = item.score; meter.setAttribute('aria-label', title); card.append(meter);
      }
      card.append(node('p', '', item.reason)); scores.append(card);
    }
    report.append(scores);
    if (data.evidence.length) {
      const evidence = node('section', 'md-evidence'); evidence.append(node('h4', '', '槽点都在这儿'));
      for (const e of data.evidence) { const row = node('p', ''); row.append(node('span', 'md-evidence-label', e.source === 'image' ? '画面' : '文案'), document.createTextNode(e.detail)); evidence.append(row); }
      report.append(evidence);
    }
    if (data.limitations) report.append(node('p', 'md-limitations', data.limitations));
    empty.hidden = true; report.hidden = false; report.focus({ preventScroll: true });
  }

  input.addEventListener('change', () => loadImage(input.files[0]), { signal: listeners.signal });
  $('.md-remove').addEventListener('click', resetImage, { signal: listeners.signal });
  textarea.addEventListener('input', () => { $('.md-char-count').textContent = `${textarea.value.length} / 5000`; invalidate(); }, { signal: listeners.signal });
  container.addEventListener('paste', (e) => {
    const file = [...(e.clipboardData?.items || [])].find(item => item.kind === 'file' && item.type.startsWith('image/'))?.getAsFile();
    if (file) { e.preventDefault(); loadImage(file); }
  }, { signal: listeners.signal });
  for (const name of ['dragenter', 'dragover']) drop.addEventListener(name, e => { e.preventDefault(); if (!busy) drop.classList.add('is-dragging'); }, { signal: listeners.signal });
  for (const name of ['dragleave', 'drop']) drop.addEventListener(name, e => { e.preventDefault(); drop.classList.remove('is-dragging'); }, { signal: listeners.signal });
  drop.addEventListener('drop', e => { const files = e.dataTransfer?.files; if (files?.length > 1) { showError('一次检测一张截图，请先选一条朋友圈。'); return; } loadImage(files?.[0]); }, { signal: listeners.signal });
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); if (busy || preparing) return;
    const text = textarea.value.trim();
    if (!text && !image) { showError('先放一张截图，或者写点文案。'); textarea.focus(); return; }
    invalidate(); busy = true; fieldset.disabled = true; updateButton();
    submit.textContent = '正在检测…'; status.textContent = 'Kimi 正在分析文案和画面，请稍等。';
    $('.md-output').setAttribute('aria-busy', 'true'); request = new AbortController();
    const timeout = setTimeout(() => request?.abort(), 75000);
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, image }), signal: request.signal });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('检测服务暂时不可用，请稍后再试。');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '检测失败，请稍后再试。');
      if (!data.valid) throw new Error(data.message || '这份内容还不足以判断，请换一张更清楚的截图。');
      if (!disposed) { renderReport(data); status.textContent = '检测完成。'; }
    } catch (e) { if (!disposed) { showError(e.name === 'AbortError' ? '检测超时了，请稍后再试。' : e.message); status.textContent = ''; } }
    finally { clearTimeout(timeout); if (!disposed) { busy = false; request = null; fieldset.disabled = false; updateButton(); submit.innerHTML = '再测一次 <span aria-hidden="true">↗</span>'; $('.md-output').setAttribute('aria-busy', 'false'); } }
  }, { signal: listeners.signal });

  return () => { disposed = true; imageVersion += 1; listeners.abort(); request?.abort(); image = ''; previewImage.removeAttribute('src'); container.replaceChildren(); };
}
