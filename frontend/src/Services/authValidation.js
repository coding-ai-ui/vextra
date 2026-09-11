export function authDestination(state) {
  const from = state?.from;
  const path = typeof from === 'string' ? from : from?.pathname ? `${from.pathname}${from.search || ''}${from.hash || ''}` : '/dashboard';
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\') && !/^\/(login|register)([/?#]|$)/.test(path) ? path : '/dashboard';
}

export function validateLogin(values) {
  const errors = {};
  if (!values.username.trim()) errors.username = 'Enter your email or username.';
  if (!values.password) errors.password = 'Enter your password.';
  return errors;
}

export function validateRegistration(values) {
  const errors = {};
  if (!values.username.trim()) errors.username = 'Choose a username.';
  else if (values.username.trim().length > 150) errors.username = 'Keep your username to 150 characters or fewer.';
  else if (!/^[\p{L}\p{N}_.+-]+$/u.test(values.username.trim())) errors.username = 'Use letters, numbers, or . + - _ without spaces.';
  if (!values.email.trim()) errors.email = 'Enter your email address.';
  else if (values.email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.';
  if (!values.password.trim()) errors.password = 'Choose a password containing letters or symbols.';
  else if (values.password.length < 8) errors.password = 'Use at least 8 characters.';
  else if (values.password.length > 128) errors.password = 'Keep your password to 128 characters or fewer.';
  else if (/^\d+$/.test(values.password)) errors.password = 'Add letters or symbols; your password cannot be entirely numeric.';
  if (!values.confirmPassword) errors.confirmPassword = 'Confirm your password.';
  else if (values.password !== values.confirmPassword) errors.confirmPassword = 'Your passwords do not match.';
  return errors;
}
