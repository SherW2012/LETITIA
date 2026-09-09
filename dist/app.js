import { modules } from './modules/registry.js';

const grid = document.querySelector('#module-grid');
const count = document.querySelector('#module-count');
const dialog = document.querySelector('#module-dialog');
const content = document.querySelector('#module-content');
const dialogTitle = document.querySelector('#dialog-title');
const liveModules = modules.filter((item) => item.status === 'live');
const number = (value) => String(value).padStart(2, '0');
let cleanup = null;
let generation = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createCard(item, index) {
  const isLive = Boolean(item);
  const card = element('article', `module-card${isLive ? ' is-live' : ''}`);
  const top = element('div', 'card-top');
  top.append(element('span', 'card-number', `NO. ${number(index + 1)}`), element('span', 'card-status', isLive ? '已上线' : '待开工'));
  const body = element('div', 'card-body');
  const title = isLive ? item.title : index === 0 ? '第一件发明，还没诞生。' : '等待一个离谱需求';
  const heading = element('h3', '', title);
  heading.id = `module-title-${index}`;
  card.setAttribute('aria-labelledby', heading.id);
  body.append(heading, element('p', '', isLive ? item.description : index === 0 ? '这里，留给第一个真能跑的小玩意。' : '这个展位，先留着。'));
  const bottom = element('div', 'card-bottom');
  const icon = element('span', 'slot-plus', isLive ? '↗' : '+');
  icon.setAttribute('aria-hidden', 'true');
  bottom.append(element('span', '', isLive ? (item.category || '独立发明') : 'EMPTY SLOT'), icon);
  card.append(top, body, bottom);
  if (isLive) {
    const button = element('button', 'open-module');
    button.type = 'button';
    button.setAttribute('aria-label', `打开${item.title}`);
    button.addEventListener('click', () => openModule(item));
    card.append(button);
  }
  return card;
}

async function openModule(item) {
  const currentGeneration = ++generation;
  dialogTitle.textContent = item.title;
  const mountPoint = element('div', 'module-mount');
  mountPoint.append(element('p', '', '正在启动…'));
  content.replaceChildren(mountPoint);
  dialog.showModal();
  try {
    const feature = await item.load();
    if (currentGeneration !== generation || !dialog.open) return;
    mountPoint.replaceChildren();
    const dispose = await feature.mount(mountPoint);
    if (currentGeneration !== generation || !dialog.open) {
      if (typeof dispose === 'function') dispose();
      return;
    }
    cleanup = typeof dispose === 'function' ? dispose : null;
  } catch (error) {
    if (currentGeneration !== generation || !dialog.open) return;
    console.error('Module failed to start:', error);
    const message = element('p', '', '这个发明暂时没启动起来，关闭后再试一次。');
    message.setAttribute('role', 'alert');
    mountPoint.replaceChildren(message);
  }
}

document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => {
  generation += 1;
  try { cleanup?.(); } finally { cleanup = null; content.replaceChildren(); }
});

count.textContent = `${number(liveModules.length)} 件已上线`;
const fragment = document.createDocumentFragment();
liveModules.forEach((item, index) => fragment.append(createCard(item, index)));
for (let index = liveModules.length; index < Math.max(6, liveModules.length + 1); index += 1) {
  fragment.append(createCard(null, index));
}
grid.replaceChildren(fragment);
