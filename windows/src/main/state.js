'use strict';

const allowed = Object.freeze({
  starting: ['listening','locked','processing','cancelled','error'],
  idle: ['starting','listening', 'offline', 'error', 'secure'],
  listening: ['locked', 'processing', 'cancelled', 'error'],
  locked: ['processing', 'cancelled', 'error'],
  processing: ['inserting', 'offline', 'error', 'listening','starting'],
  inserting: ['success', 'clipboard', 'error', 'listening','starting'],
  success: ['idle', 'listening','starting'],
  clipboard: ['idle', 'listening','starting'],
  offline: ['idle', 'listening', 'starting', 'processing'],
  error: ['idle', 'listening', 'starting', 'processing'],
  cancelled: ['idle', 'listening','starting','error','processing'],
  secure: ['idle', 'listening', 'starting']
});

function canTransition(from, to) {
  return from === to || Boolean(allowed[from] && allowed[from].includes(to));
}

module.exports = { canTransition, allowed };
