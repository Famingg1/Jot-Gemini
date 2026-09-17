'use strict';

const modelPattern = /^[a-z0-9._-]{1,100}$/iu;
function text(value, max) { return typeof value === 'string' ? value.slice(0, max) : ''; }
function sanitizeSettingsPatch(patch = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Ongeldige instellingen.');
  const clean = {};
  if (patch.hotkeys !== undefined) clean.hotkeys = require('../renderer/hotkeys').validate(patch.hotkeys);
  for (const key of ['onboardingComplete', 'smartTranscription', 'sounds', 'showIdleIndicator', 'launchAtLogin', 'meetingMicrophone', 'meetingSystemAudio', 'meetingAutoTranscribe', 'largeHud', 'preserveCode']) {
    if (typeof patch[key] === 'boolean') clean[key] = patch[key];
  }
  for (const [key, choices] of Object.entries({
    hotkey: ['right-control', 'caps-lock', 'f8'], theme: ['system', 'light', 'dark'],
    meetingAudioApp: ['chrome','teams','zoom','all'],
    language: ['auto', 'nl-NL', 'en-US', 'en-GB', 'de-DE', 'fr-FR', 'es-ES'],
    writingStyle: ['natural', 'concise', 'formal', 'code'], appLanguage: ['nl', 'en'],
    hudPosition: ['left', 'center', 'right']
  })) if (choices.includes(patch[key])) clean[key] = patch[key];
  for (const key of ['audioRetentionDays', 'meetingAudioRetentionDays']) {
    if (patch[key] !== undefined && [0, 1, 7, 30, 90].includes(Number(patch[key]))) clean[key] = Number(patch[key]);
  }
  for (const key of ['model', 'summaryModel', 'meetingModel']) if (typeof patch[key] === 'string' && modelPattern.test(patch[key])) clean[key] = patch[key];
  if (typeof patch.microphoneId === 'string') clean.microphoneId = text(patch.microphoneId, 512);
  if (typeof patch.scratchpad === 'string') clean.scratchpad = text(patch.scratchpad, 200000);
  if (typeof patch.activeCodingProfile === 'string') clean.activeCodingProfile = text(patch.activeCodingProfile, 100);
  if (Array.isArray(patch.dictionary)) clean.dictionary = [...new Set(patch.dictionary.filter(v => typeof v === 'string').map(v => v.trim()).filter(Boolean))].slice(0, 1000).map(v => v.slice(0, 100));
  if (Array.isArray(patch.replacements)) clean.replacements = patch.replacements.slice(0, 500).map(item => ({ from: text(item?.from, 100).trim(), to: text(item?.to, 100) })).filter(item => item.from);
  if (Array.isArray(patch.snippets)) clean.snippets = patch.snippets.slice(0, 500).map(item => ({ id: text(item?.id, 100), trigger: text(item?.trigger, 100).trim(), text: text(item?.text, 20000) })).filter(item => item.id && item.trigger);
  if (Array.isArray(patch.transforms)) clean.transforms = patch.transforms.slice(0, 100).map(item => ({ id: text(item?.id, 100), name: text(item?.name, 100).trim(), instruction: text(item?.instruction, 5000).trim() })).filter(item => item.id && item.name && item.instruction);
  if (Array.isArray(patch.codingProfiles)) clean.codingProfiles = patch.codingProfiles.slice(0, 50).map(item => ({
    id: text(item?.id, 100), name: text(item?.name, 100).trim(), preserveCode: item?.preserveCode !== false,
    vocabulary: Array.isArray(item?.vocabulary) ? item.vocabulary.filter(v => typeof v === 'string').slice(0, 100).map(v => v.slice(0, 100)) : []
  })).filter(item => item.id && item.name);
  return clean;
}

module.exports = { sanitizeSettingsPatch };
