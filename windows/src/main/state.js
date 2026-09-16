'use strict';

const allowed = Object.freeze({
  idle: ['listening', 'offline', 'error', 'secure'],
  listening: ['locked', 'processing', 'cancelled', 'error'],
  locked: ['processing', 'cancelled', 'error'],
  processing: ['inserting', 'offline', 'error', 'listening'],
  inserting: ['success', 'clipboard', 'error', 'listening'],
  success: ['idle', 'listening'],
  clipboard: ['idle', 'listening'],
  offline: ['idle', 'listening', 'processing'],
  error: ['idle', 'listening', 'processing'],
  cancelled: ['idle', 'listening'],
  secure: ['idle', 'listening']
});

function canTransition(from, to) {
  return from === to || Boolean(allowed[from] && allowed[from].includes(to));
}

module.exports = { canTransition, allowed };
