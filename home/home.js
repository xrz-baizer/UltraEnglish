'use strict';
// Optional support/privacy links stay hidden until configured.
const SITE_CONFIG = Object.freeze({
  repositoryUrl: 'https://github.com/xrz-baizer/UltraEnglish',
  releaseUrl: 'https://github.com/xrz-baizer/UltraEnglish/releases',
  supportUrl: '',
  privacyUrl: ''
});
let language = 'zh-CN';
let selectedSentence = 0;
let selectionAnchor = 5;
let selectionEnd = 7;
const text = (zh, en) => language === 'zh-CN' ? zh : en;
const nodes = Array.from(document.querySelectorAll('[data-en]'));
nodes.forEach(node => { node.dataset.zh = node.textContent; });
const labeledNodes = Array.from(document.querySelectorAll('[data-en-label]'));
labeledNodes.forEach(node => { node.dataset.zhLabel = node.getAttribute('aria-label'); });
const description = document.querySelector('meta[name="description"]');
const chineseDescription = description.content;

const sentences = [
  'Struggling to keep up with long English sentences, even after listening again?',
  'Pick a short phrase, and practise it on repeat.',
  'Shadow, sing and spell, in one English learning app.'
];

const ttsSentences = [
  'Listen closely to the rhythm of each phrase, then shadow it at your own pace.',
  'Pick a short phrase that feels tricky, and listen to how the words link together.',
  'Clear pronunciation begins with active listening and steady daily practice.'
];
let ttsPlayTimer = 0;
const ttsWorkspace = document.querySelector('.tts-simple-workspace');
const ttsCurrentVoice = document.getElementById('tts-current-voice');
const ttsSampleText = document.getElementById('tts-sample-text');
const ttsGenerateBtn = document.getElementById('tts-generate-btn');
const ttsGenerateLabel = document.getElementById('tts-generate-label');
const ttsResultStatus = document.getElementById('tts-result-status');

document.querySelectorAll('[data-tts-voice]').forEach((btn, idx) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-tts-voice]').forEach(item => {
      item.setAttribute('aria-pressed', String(item === btn));
    });
    const zhName = btn.getAttribute('data-tts-voice');
    const enName = btn.getAttribute('data-tts-voice-en');
    ttsCurrentVoice.dataset.zh = zhName;
    ttsCurrentVoice.dataset.en = enName;
    ttsCurrentVoice.textContent = text(zhName, enName);
    ttsSampleText.textContent = ttsSentences[idx] || ttsSentences[0];
    ttsResultStatus.textContent = text('MP3 · 字幕同步入库', 'MP3 · Subtitles synced');
  });
});

ttsGenerateBtn.addEventListener('click', () => {
  clearTimeout(ttsPlayTimer);
  ttsWorkspace.classList.add('is-playing');
  ttsGenerateLabel.textContent = text('已生成', 'Generated');
  ttsResultStatus.textContent = text('已生成 MP3 音频并同步字幕', 'MP3 generated · Subtitles synced');
  ttsPlayTimer = setTimeout(() => {
    ttsWorkspace.classList.remove('is-playing');
    ttsGenerateLabel.textContent = text('生成音频', 'Generate audio');
  }, 1600);
});

const input = document.getElementById('typing-input');
function updateNote() {
  const container = document.getElementById('sample-sentence');
  container.replaceChildren();
  let wordIndex = 0;
  const sentence = sentences[selectedSentence];
  const splitAt = sentence.lastIndexOf(',') + 1;
  const clauses = [sentence.slice(0, splitAt), sentence.slice(splitAt).trim()];
  clauses.forEach(clause => {
    const line = document.createElement('span');
    line.className = 'sentence-clause';
    clause.split(' ').forEach(word => {
      const index = wordIndex++;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'word-button'; button.textContent = word;
      button.dataset.word = String(index);
      button.addEventListener('click', event => {
        if (!event.shiftKey) selectionAnchor = index;
        selectionEnd = index;
        updateSelection();
      });
      line.append(button, document.createTextNode(' '));
    });
    container.append(line);
  });
  updateSelection();
}
function updateSelection() {
  const words = sentences[selectedSentence].split(' ');
  const from = Math.min(selectionAnchor, selectionEnd);
  const to = Math.max(selectionAnchor, selectionEnd);
  document.querySelectorAll('[data-word]').forEach(button => {
    const index = Number(button.dataset.word);
    button.setAttribute('aria-pressed', String(index >= from && index <= to));
  });
  document.querySelectorAll('.wave i').forEach((bar, index, bars) => {
    const position = index / bars.length;
    bar.classList.toggle('selected', position >= from / words.length && position < (to + 1) / words.length);
  });
}
function updateTyping() {
  const value = input.value.trim().toLowerCase();
  const correct = value === 'curiosity';
  input.classList.toggle('correct', correct);
  document.getElementById('typing-feedback').textContent = correct
    ? text('写对了。下一次，也记得住。', 'You got it. One more word to remember.')
    : value && !'curiosity'.startsWith(value)
      ? text('再看看，有个字母不太对。', 'Take another look at the letters.')
      : text('从一个词，开始积累。', 'It starts with a single word.');
}

const tabs = ['tab-audio', 'tab-tts', 'tab-typing'].map(id => document.getElementById(id));
function updateWindowTitle() {
  const isTts = document.getElementById('tab-tts').getAttribute('aria-selected') === 'true';
  const isAudio = document.getElementById('tab-audio').getAttribute('aria-selected') === 'true';
  document.getElementById('window-title').textContent = isTts
    ? text('把英文句子，变成自然流畅的语音。', 'Turn English sentences into natural audio.')
    : isAudio
      ? text('选中其中一小段，反复跟读。', 'Pick a short phrase. Practise it on repeat.')
      : text('每个单词，都记得更牢。', 'Make every word stick.');
}
function selectTab(tab) {
  tabs.forEach(item => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
  });
  updateWindowTitle();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectTab(tab));
  tab.addEventListener('keydown', event => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[next]); tabs[next].focus();
  });
});

document.getElementById('language').addEventListener('click', event => {
  language = language === 'zh-CN' ? 'en' : 'zh-CN';
  document.documentElement.lang = language;
  nodes.forEach(node => { node.textContent = language === 'en' ? node.dataset.en : node.dataset.zh; });
  labeledNodes.forEach(node => { node.setAttribute('aria-label', language === 'en' ? node.dataset.enLabel : node.dataset.zhLabel); });
  event.currentTarget.textContent = language === 'en' ? '中文' : 'EN';
  event.currentTarget.setAttribute('aria-label', language === 'en' ? '切换到简体中文' : 'Switch to English');
  document.title = text('UltraEnglish — 英语跟读，长句跟不上？选中其中一小段，反复跟读。', 'UltraEnglish — Long sentences hard to shadow? Pick a phrase. Practise on repeat.');
  description.content = text(chineseDescription, description.dataset.enContent);
  updateNote(); updateTyping(); updateWindowTitle(); updatePersonalPreview(); updateStoryStageTitle(activeStoryStep);
});

document.querySelectorAll('[data-sentence]').forEach(button => button.addEventListener('click', () => {
  selectedSentence = Number(button.dataset.sentence);
  selectionAnchor = 0; selectionEnd = 1;
  document.querySelectorAll('[data-sentence]').forEach(item => { item.setAttribute('aria-pressed', String(item === button)); });
  updateNote();
}));
input.addEventListener('input', updateTyping);

function wirePreviewTabs(container, onSelect) {
  const previewTabs = Array.from(container.querySelectorAll('.settings-tab, [role="tab"]'));
  function activate(tab) {
    previewTabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    onSelect(tab);
  }
  previewTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? previewTabs.length - 1
        : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + previewTabs.length) % previewTabs.length;
      activate(previewTabs[next]);
      previewTabs[next].focus();
    });
  });
}
wirePreviewTabs(document.getElementById('personal-tabs'), tab => {
  document.querySelectorAll('.personal-content [role="tabpanel"]').forEach(panel => {
    panel.hidden = panel.id !== tab.getAttribute('aria-controls');
  });
});
const compactSettings = window.matchMedia('(max-width:600px)');
const syncPreviewOrientation = () => document.getElementById('personal-tabs').setAttribute('aria-orientation', compactSettings.matches ? 'horizontal' : 'vertical');
compactSettings.addEventListener('change', syncPreviewOrientation);
window.addEventListener('resize', syncPreviewOrientation);
syncPreviewOrientation();
let previewMode = 'fill';
let previewRepeats = 3;
let previewColor = '#0066cc';
function updatePersonalPreview() {
  const word = document.getElementById('live-word');
  const size = Number(document.getElementById('preview-size').value);
  word.style.fontFamily = document.getElementById('preview-font').value;
  word.style.fontSize = `${size}px`;
  word.style.fontWeight = document.getElementById('preview-bold').checked ? '700' : '400';
  word.style.color = previewColor;
  const shuffled = document.getElementById('preview-random').checked;
  word.textContent = previewMode === 'dictation' ? '•••••••••' : shuffled ? 'practice' : 'curiosity';
  document.getElementById('live-meaning').textContent = shuffled
    ? text('n. 练习；实践', 'noun · repeated exercise') : text('n. 好奇心；求知欲', 'noun · a desire to learn');
  document.getElementById('preview-size-value').value = String(size);
  document.getElementById('live-mode').textContent = previewMode === 'dictation'
    ? text('默写练习', 'Dictation practice') : text('填空练习', 'Fill-in practice');
  const dots = document.getElementById('repeat-dots');
  dots.replaceChildren(...Array.from({ length: previewRepeats }, () => document.createElement('i')));
}
['preview-font', 'preview-size', 'preview-bold', 'preview-random'].forEach(id => {
  document.getElementById(id).addEventListener('input', updatePersonalPreview);
});
[['data-preview-color', value => { previewColor = value; }], ['data-preview-mode', value => { previewMode = value; }], ['data-preview-repeats', value => { previewRepeats = Number(value); }]].forEach(([attribute, setValue]) => {
  document.querySelectorAll(`[${attribute}]`).forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll(`[${attribute}]`).forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    setValue(button.getAttribute(attribute));
    updatePersonalPreview();
  }));
});
updatePersonalPreview();
const wave = document.querySelector('.wave');
for (let i = 0; i < 68; i++) {
  const bar = document.createElement('i');
  bar.style.height = `${7 + Math.abs(Math.sin(i * .71) * Math.cos(i * .16)) * 40}px`;
  wave.appendChild(bar);
}
updateNote();
const externalLinks = {
  'repository-link': SITE_CONFIG.repositoryUrl, 'release-link': SITE_CONFIG.releaseUrl,
  'support-link': SITE_CONFIG.supportUrl, 'privacy-link': SITE_CONFIG.privacyUrl
};
for (const [id, value] of Object.entries(externalLinks)) {
  if (!value) continue;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) continue;
    const link = document.getElementById(id);
    if (!link) continue;
    link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.hidden = false;
  } catch { /* 无效链接保持隐藏。Invalid links remain hidden. */ }
}
const topbar = document.querySelector('.topbar');
function updateScrollEdge() { topbar.classList.toggle('scrolled', scrollY > 8); }
addEventListener('scroll', updateScrollEdge, { passive: true });
updateScrollEdge();

// “从一句英文开始” 左右联动与滚动高亮
const storySteps = [...document.querySelectorAll('.story-steps .feature')];
const storyProgress = [...document.querySelectorAll('.story-progress i')];
const storyPanes = [...document.querySelectorAll('[data-story-pane]')];
const storyStageTitle = document.getElementById('story-stage-title');
const storyStepCounter = document.getElementById('story-step-counter');
const storyTitles = [
  ['文本生成音频', 'Text to audio'],
  ['音频转文字', 'Audio to text'],
  ['选段跟读', 'Phrase shadowing'],
  ['单词拼写练习', 'Spelling practice']
];
let activeStoryStep = 0;
let manualStoryLockUntil = 0;

for (const preview of document.querySelectorAll('.story-wave')) {
  for (const bar of wave.children) preview.appendChild(bar.cloneNode(false));
}

function updateStoryStageTitle(index) {
  const pair = storyTitles[index] || storyTitles[0];
  if (storyStageTitle) storyStageTitle.textContent = text(pair[0], pair[1]);
  if (storyStepCounter) storyStepCounter.textContent = `0${index + 1} / 0${storySteps.length}`;
}

function setActiveStoryStep(current) {
  activeStoryStep = current;
  storySteps.forEach((step, index) => step.classList.toggle('is-current', index === current));
  storyProgress.forEach((segment, index) => segment.classList.toggle('filled', index <= current));
  storyPanes.forEach((pane, index) => { pane.hidden = index !== current; });
  updateStoryStageTitle(current);
}

const spotlight = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
storySteps.forEach((step, index) => {
  step.addEventListener('pointermove', event => {
    if (!spotlight.matches) return;
    const bounds = step.getBoundingClientRect();
    step.style.setProperty('--spot-x', (event.clientX - bounds.left) + 'px');
    step.style.setProperty('--spot-y', (event.clientY - bounds.top) + 'px');
  });
  step.addEventListener('click', () => {
    manualStoryLockUntil = Date.now() + 1800;
    setActiveStoryStep(index);
  });
  step.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      manualStoryLockUntil = Date.now() + 1800;
      setActiveStoryStep(index);
    }
  });
});
storyProgress.forEach((dot, index) => {
  dot.addEventListener('click', () => {
    manualStoryLockUntil = Date.now() + 1800;
    setActiveStoryStep(index);
  });
});

let storyFrame = 0;
function updateStory() {
  storyFrame = 0;
  if (Date.now() < manualStoryLockUntil) return;
  const middle = window.innerHeight * .52;
  const next = storySteps.findIndex(step => step.getBoundingClientRect().bottom >= middle);
  const current = next < 0 ? storySteps.length - 1 : next;
  setActiveStoryStep(current);
}
function scheduleStory() {
  if (!storyFrame) storyFrame = requestAnimationFrame(updateStory);
}
window.addEventListener('scroll', scheduleStory, { passive: true });
window.addEventListener('resize', scheduleStory);
setActiveStoryStep(0);

// Windows 下载“敬请期待”弹窗控制
const winBtn = document.getElementById('download-windows-btn');
const winModal = document.getElementById('windows-modal');
const winModalClose = document.getElementById('windows-modal-close');
let lastFocusedBeforeModal = null;

function openWindowsModal() {
  lastFocusedBeforeModal = document.activeElement;
  winModal.hidden = false;
  winModalClose.focus();
}
function closeWindowsModal() {
  winModal.hidden = true;
  if (lastFocusedBeforeModal && typeof lastFocusedBeforeModal.focus === 'function') {
    lastFocusedBeforeModal.focus();
  }
}
if (winBtn && winModal && winModalClose) {
  winBtn.addEventListener('click', openWindowsModal);
  winModalClose.addEventListener('click', closeWindowsModal);
  winModal.addEventListener('click', event => {
    if (event.target === winModal) closeWindowsModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !winModal.hidden) closeWindowsModal();
  });
}

if ('IntersectionObserver' in window) {
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('reveal-enter');
      reveal.unobserve(entry.target);
    }
  });
  document.querySelectorAll('.story-steps .feature, .showcase-heading, .theme-window, .release, .story-heading').forEach(element => reveal.observe(element));
}
