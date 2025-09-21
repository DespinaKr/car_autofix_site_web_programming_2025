function notEmpty(v){ return v !== undefined && v !== null && String(v).trim() !== ''; }
function isEmail(v){ return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); }
function inEnum(v, arr){ return arr.includes(v); }
function timeHHMM(v){ return /^\d{2}:\d{2}$/.test(v); }
module.exports = { notEmpty, isEmail, inEnum, timeHHMM };
