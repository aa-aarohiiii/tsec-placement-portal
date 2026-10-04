/**
 * Small input-validation helpers. Each returns a cleaned value or throws
 * a ValidationError with a friendly message that is shown to the user.
 */
class ValidationError extends Error {
  constructor(message) { super(message); this.status = 400; }
}

const str = (v, field, { required = false, max = 200 } = {}) => {
  const s = v === undefined || v === null ? '' : String(v).trim();
  if (required && !s) throw new ValidationError(`${field} is required.`);
  if (s.length > max) throw new ValidationError(`${field} must be at most ${max} characters.`);
  return s || null;
};

const num = (v, field, { required = false, min = -Infinity, max = Infinity, int = false } = {}) => {
  if (v === undefined || v === null || v === '') {
    if (required) throw new ValidationError(`${field} is required.`);
    return null;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw new ValidationError(`${field} must be a number.`);
  if (int && !Number.isInteger(n)) throw new ValidationError(`${field} must be a whole number.`);
  if (n < min || n > max) throw new ValidationError(`${field} must be between ${min} and ${max}.`);
  return n;
};

const oneOf = (v, field, options, { required = true } = {}) => {
  if ((v === undefined || v === null || v === '') && !required) return null;
  if (!options.includes(v)) throw new ValidationError(`Please choose a valid ${field}.`);
  return v;
};

const email = (v) => {
  const s = str(v, 'Email', { required: true, max: 120 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new ValidationError('Please enter a valid email address.');
  return s;
};

const url = (v, field) => {
  const s = str(v, field, { max: 300 });
  if (!s) return null;
  if (!/^https?:\/\/[^\s]+$/i.test(s)) throw new ValidationError(`${field} must start with http:// or https://`);
  return s;
};

const phone = (v) => {
  const s = str(v, 'Phone', { max: 20 });
  if (!s) return null;
  const digits = s.replace(/[\s-]/g, '').replace(/^\+91/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) throw new ValidationError('Please enter a valid 10-digit Indian mobile number.');
  return digits;
};

const password = (v) => {
  const s = v === undefined || v === null ? '' : String(v);
  if (s.length < 8) throw new ValidationError('Password must be at least 8 characters.');
  if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) throw new ValidationError('Password must contain at least one letter and one number.');
  if (s.length > 72) throw new ValidationError('Password is too long.');
  return s;
};

const idList = (v) => {
  if (!Array.isArray(v) || v.length === 0) throw new ValidationError('Select at least one item.');
  const ids = [...new Set(v.map(Number))];
  if (ids.some((x) => !Number.isInteger(x) || x <= 0)) throw new ValidationError('Invalid selection.');
  return ids;
};

module.exports = { ValidationError, str, num, oneOf, email, url, phone, password, idList };
