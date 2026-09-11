import { analyzeCode, COMMIT_THRESHOLD } from './rules.js';

const stylesheet = new URL('./style.css', import.meta.url).href;
const SAMPLE = `function handleUserData(data) {
  var tmp = data;
  console.log("here", tmp);
  // TODO: 先这样，以后再改
  if (tmp) {
    if (tmp.user) {
      if (tmp.user.profile) {
        if (tmp.user.profile.settings.theme.color.value == 16777215) {
          try { save(tmp); } catch (e) {}
          return tmp.user.profile.settings.theme.color.value;
        }
      }
    }
  }
  var temp2 = data.list.filter(x => x.ok).map(x => x.id).join(",").split(",").slice(0, 100);
  return temp2 ? temp2.length > 3 ? temp2[0] : temp2[1] : null;
}`;

export function mount(container) {
  if (!document.querySelector('link[data-shit-style]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = stylesheet; link.dataset.shitStyle = '';
    document.head.append(link);
  }
  container.innerHTML = `
    <section class="sd" aria-label="屎山浓度报警器">
      <div class="sd-vignette" aria-hidden="true"></div>
      <div class="sd-intro">
        <span class="sd-kicker">LETITIA / EXPERIMENT 003</span>
        <p>代码写得越烂，<strong>这里就越红。</strong></p>
        <p class="sd-sub">打字时由本地规则实时判定，不联网、不上传。只有你点「让 AI 骂一句」才会把代码发出去。</p>
      </div>
      <div class="sd-layout">
        <div class="sd-editor">
          <div class="sd-bar">
            <span class="sd-dot" aria-hidden="true"></span>
            <span class="sd-file">untitled</span>
            <label class="sd-lang-label" for="sd-lang">语言</label>
            <select id="sd-lang" class="sd-lang">
              <option value="">自动</option><option value="javascript">JavaScript</option><option value="typescript">TypeScript</option>
              <option value="python">Python</option><option value="java">Java</option><option value="go">Go</option>
              <option value="cpp">C / C++</option><option value="csharp">C#</option><option value="php">PHP</option><option value="other">其他</option>
            </select>
            <button class="sd-sample" type="button">来段样例</button>
          </div>
          <div class="sd-code">
            <pre class="sd-gutter" aria-hidden="true">1</pre>
            <textarea id="sd-input" class="sd-input" spellcheck="false" autocapitalize="off" autocomplete="off" wrap="off" maxlength="20000" aria-label="把代码贴在这里" placeholder="把你刚写的那段贴进来…"></textarea>
          </div>
          <div class="sd-actions">
            <button class="sd-roast" type="button">让 AI 骂一句 <span aria-hidden="true">↗</span></button>
            <button class="sd-commit" type="button">git commit <span aria-hidden="true">↵</span></button>
            <span class="sd-chars">0 / 20000</span>
          </div>
          <p class="sd-status" role="status" aria-live="polite"></p>
          <p class="sd-error" role="alert" hidden></p>
        </div>
        <aside class="sd-panel" aria-label="屎山浓度报警">
          <div class="sd-gauge">
            <div class="sd-gauge-top"><span class="sd-gauge-label">屎山浓度</span><span class="sd-lamp" aria-hidden="true"></span></div>
            <div class="sd-score-row"><strong class="sd-score">0</strong><span class="sd-unit">/ 100</span></div>
            <meter class="sd-meter" min="0" max="100" low="35" high="70" optimum="0" value="0" aria-label="屎山浓度"></meter>
            <h3 class="sd-level">等着你写</h3>
            <p class="sd-note">贴段代码进来，本地规则会边打字边判。</p>
          </div>
          <section class="sd-signals" aria-label="命中的毛病">
            <h4>本地规则命中</h4>
            <ul class="sd-signal-list"><li class="sd-signal-empty">暂时没什么好说的。</li></ul>
          </section>
          <section class="sd-ai" aria-label="AI 判词">
            <h4>AI 判词</h4>
            <div class="sd-ai-body"><p class="sd-ai-empty">还没请 AI 开口。</p></div>
          </section>
        </aside>
      </div>
      <p class="sd-disclaimer">本地规则只看得见表面特征，看不懂你的业务，也不是 lint 和 code review 的替代品。分数是节目效果，别拿它考核别人。</p>
      <dialog class="sd-confirm" aria-labelledby="sd-confirm-title">
        <h3 id="sd-confirm-title">你确定这玩意要提交？</h3>
        <p class="sd-confirm-body"></p>
        <form method="dialog" class="sd-confirm-actions">
          <button value="stay" class="sd-stay" type="submit">我再改改</button>
          <button value="commit" class="sd-go" type="submit">就这样，提交</button>
        </form>
      </dialog>
    </section>`;

  const $ = (selector) => container.querySelector(selector);
  const surface = container.closest('.module-dialog') || container;
  const root = $('.sd'), input = $('.sd-input'), gutter = $('.sd-gutter'), confirm = $('.sd-confirm');
  const score = $('.sd-score'), meter = $('.sd-meter'), level = $('.sd-level'), note = $('.sd-note');
  const list = $('.sd-signal-list'), aiBody = $('.sd-ai-body'), status = $('.sd-status'), error = $('.sd-error');
  const roastButton = $('.sd-roast'), commitButton = $('.sd-commit'), chars = $('.sd-chars');
  const listeners = new AbortController();
  let request = null, disposed = false, frame = 0, current = analyzeCode(''), aiQuestion = '';
  let announced = { name: '', score: 0 };

  const node = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
  const showError = (message) => { error.textContent = message; error.hidden = !message; };

  function paint(result) {
    const ratio = result.score / 100;
    root.style.setProperty('--shit', ratio.toFixed(3));
    score.textContent = String(result.score);
    meter.value = result.score;
    level.textContent = result.level.name;
    note.textContent = result.level.note;
    const hot = result.score >= COMMIT_THRESHOLD + 5;
    root.classList.toggle('is-critical', hot);
    surface.classList.toggle('sd-surface-warm', result.score >= 45);
    surface.classList.toggle('sd-surface-critical', hot);
    commitButton.classList.toggle('is-armed', result.score >= COMMIT_THRESHOLD);
    list.replaceChildren();
    if (!result.signals.length) list.append(node('li', 'sd-signal-empty', result.codeLines ? '本地规则没挑出毛病。难得。' : '暂时没什么好说的。'));
    for (const signal of result.signals.slice(0, 7)) {
      const item = node('li', 'sd-signal');
      item.append(node('span', 'sd-signal-label', signal.label), node('span', 'sd-signal-count', signal.line ? `第 ${signal.line} 行起 · ×${signal.count}` : `×${signal.count}`));
      list.append(item);
    }
    // 不在每次敲键盘时都播报，等级变了或分数明显挪动才更新一次。
    if (result.level.name !== announced.name || Math.abs(result.score - announced.score) >= 10) {
      announced = { name: result.level.name, score: result.score };
      status.textContent = `当前判定：${result.level.name}，浓度 ${result.score}。`;
    }
  }

  function refresh() {
    const value = input.value;
    chars.textContent = `${value.length} / 20000`;
    const lines = value.split('\n').length;
    gutter.textContent = Array.from({ length: lines }, (unused, index) => index + 1).join('\n');
    current = analyzeCode(value);
    paint(current);
    roastButton.disabled = !value.trim();
    commitButton.disabled = !value.trim();
  }

  function renderAi(data) {
    aiQuestion = data.commit_question || '';
    aiBody.replaceChildren();
    const head = node('div', 'sd-ai-head');
    head.append(node('span', 'sd-ai-level', data.level), node('span', 'sd-ai-score', `AI 打 ${data.score} 分`));
    aiBody.append(head, node('p', 'sd-verdict', data.verdict));
    if (data.issues.length) {
      const issues = node('ul', 'sd-issues');
      for (const issue of data.issues) {
        const item = node('li', 'sd-issue');
        item.append(node('span', 'sd-issue-line', issue.line ? `第 ${issue.line} 行` : '整段'), node('code', 'sd-issue-quote', issue.quote), node('p', 'sd-issue-comment', issue.comment));
        issues.append(item);
      }
      aiBody.append(issues);
    }
    if (data.limitations) aiBody.append(node('p', 'sd-limitations', data.limitations));
  }

  input.addEventListener('input', () => { if (frame) return; frame = requestAnimationFrame(() => { frame = 0; refresh(); }); }, { signal: listeners.signal });
  input.addEventListener('scroll', () => { gutter.scrollTop = input.scrollTop; }, { signal: listeners.signal });
  $('.sd-sample').addEventListener('click', () => { input.value = SAMPLE; refresh(); input.focus(); }, { signal: listeners.signal });

  commitButton.addEventListener('click', () => {
    if (current.score < COMMIT_THRESHOLD) {
      status.textContent = current.score < 20 ? '提交成功。这次确实没什么好拦的。' : '提交成功。浓度还在可接受范围，下不为例。';
      return;
    }
    $('#sd-confirm-title').textContent = aiQuestion || '你确定这玩意要提交？';
    $('.sd-confirm-body').textContent = `当前屎山浓度 ${current.score}，判定「${current.level.name}」。${current.worstLine ? `问题最早出现在第 ${current.worstLine} 行。` : ''}`;
    confirm.showModal();
  }, { signal: listeners.signal });

  confirm.addEventListener('close', () => {
    if (confirm.returnValue === 'commit') status.textContent = `已提交。浓度 ${current.score} 已记入案底，三个月后你会回来找这段代码。`;
    else if (confirm.returnValue === 'stay') { status.textContent = '拦下了。改完再来。'; input.focus(); }
  }, { signal: listeners.signal });

  roastButton.addEventListener('click', async () => {
    const code = input.value.trim();
    if (!code || request) return;
    showError(''); roastButton.disabled = true; roastButton.textContent = '正在挨骂…';
    status.textContent = '代码已发送给 Kimi，正在生成判词。';
    aiBody.replaceChildren(node('p', 'sd-ai-empty', '等一下，正在组织语言…'));
    request = new AbortController();
    const timeout = setTimeout(() => request?.abort(), 70000);
    try {
      const response = await fetch('/api/roast-code', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: request.signal,
        body: JSON.stringify({ code, language: $('.sd-lang').value || undefined, signals: current.signals.slice(0, 16).map((item) => item.id) }),
      });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('审查服务暂时不可用，请稍后再试。');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '这次没骂出来，请稍后再试。');
      if (!data.valid) throw new Error(data.message || '这段代码还不够看，贴完整一点。');
      if (!disposed) { renderAi(data); status.textContent = 'AI 判词已出。'; }
    } catch (e) {
      if (!disposed) {
        showError(e.name === 'AbortError' ? '这次审查超时了，请稍后再试。' : e.message);
        status.textContent = ''; aiBody.replaceChildren(node('p', 'sd-ai-empty', '这次没骂成，本地规则还在。'));
      }
    } finally {
      clearTimeout(timeout); request = null;
      if (!disposed) { roastButton.disabled = !input.value.trim(); roastButton.innerHTML = '再骂一次 <span aria-hidden="true">↗</span>'; }
    }
  }, { signal: listeners.signal });

  refresh();
  input.focus();
  return () => {
    disposed = true; listeners.abort(); request?.abort();
    if (frame) cancelAnimationFrame(frame);
    if (confirm.open) confirm.close();
    surface.classList.remove('sd-surface-warm', 'sd-surface-critical');
    container.replaceChildren();
  };
}
