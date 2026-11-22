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
document.getElementById('language').addEventListener('click', event => {
  language = language === 'zh-CN' ? 'en' : 'zh-CN';
  document.documentElement.lang = language;
  nodes.forEach(node => { node.textContent = language === 'en' ? node.dataset.en : node.dataset.zh; });
  labeledNodes.forEach(node => { node.setAttribute('aria-label', language === 'en' ? node.dataset.enLabel : node.dataset.zhLabel); });
  event.currentTarget.textContent = language === 'en' ? '中文' : 'EN';
  event.currentTarget.setAttribute('aria-label', language === 'en' ? '切换到简体中文' : 'Switch to English');
  document.title = text('UltraEnglish — 英语跟读，长句跟不上？选中其中一小段，反复跟读。', 'UltraEnglish — Long sentences hard to shadow? Pick a phrase. Practise on repeat.');
  description.content = text(chineseDescription, description.dataset.enContent);
  updateNote(); updateTyping(); updateWindowTitle(); updatePersonalPreview();
});
document.querySelectorAll('[data-sentence]').forEach(button => button.addEventListener('click', () => {
  selectedSentence = Number(button.dataset.sentence);
  selectionAnchor = 0; selectionEnd = 1;
  document.querySelectorAll('[data-sentence]').forEach(item => { item.setAttribute('aria-pressed', String(item === button)); });
  updateNote();
}));
input.addEventListener('input', updateTyping);
const tabs = Array.from(document.querySelectorAll('.mode-dock [role="tab"]'));
function updateWindowTitle() {
  const isAudio = document.getElementById('tab-audio').getAttribute('aria-selected') === 'true';
  document.getElementById('window-title').textContent = isAudio
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
function wirePreviewTabs(container, onSelect) {
  const previewTabs = Array.from(container.querySelectorAll('[role="tab"]'));
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
[['color', value => { previewColor = value; }], ['mode', value => { previewMode = value; }], ['repeats', value => { previewRepeats = Number(value); }]].forEach(([kind, setValue]) => {
  const attribute = `data-preview-${kind}`;
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
    link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.hidden = false;
  } catch { /* 无效链接保持隐藏。Invalid links remain hidden. */ }
}
const topbar = document.querySelector('.topbar');
function updateScrollEdge() { topbar.classList.toggle('scrolled', scrollY > 8); }
addEventListener('scroll', updateScrollEdge, { passive: true });
updateScrollEdge();


const storySteps = [...document.querySelectorAll('.story-steps .feature')];
const storyProgress = document.querySelectorAll('.story-progress i');
for (const preview of document.querySelectorAll('.story-wave')) {
  for (const bar of wave.children) preview.appendChild(bar.cloneNode(false));
}
const spotlight = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)');
storySteps.forEach(step => {
  step.addEventListener('pointermove', event => {
    if (!spotlight.matches) return;
    const bounds = step.getBoundingClientRect();
    step.style.setProperty('--spot-x', (event.clientX - bounds.left) + 'px');
    step.style.setProperty('--spot-y', (event.clientY - bounds.top) + 'px');
  });
});

let storyFrame = 0;
function updateStory() {
  storyFrame = 0;
  const middle = window.innerHeight * .5;
  const next = storySteps.findIndex(step => step.getBoundingClientRect().bottom >= middle);
  const current = next < 0 ? storySteps.length - 1 : next;
  storySteps.forEach((step, index) => step.classList.toggle('is-current', index === current));
  storyProgress.forEach((segment, index) => segment.classList.toggle('filled', index <= current));
}
function scheduleStory() {
  if (!storyFrame) storyFrame = requestAnimationFrame(updateStory);
}
window.addEventListener('scroll', scheduleStory, { passive: true });
window.addEventListener('resize', scheduleStory);
updateStory();

if ('IntersectionObserver' in window) {
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('reveal-enter');
      reveal.unobserve(entry.target);
    }
  });
  document.querySelectorAll('.story-steps .feature, .showcase-heading, .theme-window, .release').forEach(element => reveal.observe(element));
}
