/**
 * User Input Validation Utilities
 */

/**
 * Validate username
 * Rules: 3-30 characters, alphanumeric with underscores and hyphens
 */
export const validateUsername = (username) => {
  const errors = [];
  
  if (!username) {
    errors.push('Username is required');
    return { isValid: false, errors };
  }
  
  if (typeof username !== 'string') {
    errors.push('Username must be a string');
    return { isValid: false, errors };
  }
  
  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  
  if (username.length > 30) {
    errors.push('Username must not exceed 30 characters');
  }
  
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate password
 * Rules: 8-128 characters, must include uppercase, lowercase, number, and special character
 */
export const validatePassword = (password) => {
  const errors = [];
  
  if (!password) {
    errors.push('Password is required');
    return { isValid: false, errors };
  }
  
  if (typeof password !== 'string') {
    errors.push('Password must be a string');
    return { isValid: false, errors };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate first name
 * Rules: 1-50 characters, letters only (with spaces, hyphens, and apostrophes)
 */
export const validateFirstName = (firstName) => {
  const errors = [];
  
  if (!firstName) {
    errors.push('First name is required');
    return { isValid: false, errors };
  }
  
  if (typeof firstName !== 'string') {
    errors.push('First name must be a string');
    return { isValid: false, errors };
  }
  
  const trimmedName = firstName.trim();
  
  if (trimmedName.length < 1) {
    errors.push('First name cannot be empty');
  }
  
  if (trimmedName.length > 50) {
    errors.push('First name must not exceed 50 characters');
  }
  
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  if (!nameRegex.test(trimmedName)) {
    errors.push('First name can only contain letters, spaces, hyphens, and apostrophes');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate last name
 * Rules: 1-50 characters, letters only (with spaces, hyphens, and apostrophes)
 */
export const validateLastName = (lastName) => {
  const errors = [];
  
  if (!lastName) {
    errors.push('Last name is required');
    return { isValid: false, errors };
  }
  
  if (typeof lastName !== 'string') {
    errors.push('Last name must be a string');
    return { isValid: false, errors };
  }
  
  const trimmedName = lastName.trim();
  
  if (trimmedName.length < 1) {
    errors.push('Last name cannot be empty');
  }
  
  if (trimmedName.length > 50) {
    errors.push('Last name must not exceed 50 characters');
  }
  
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  if (!nameRegex.test(trimmedName)) {
    errors.push('Last name can only contain letters, spaces, hyphens, and apostrophes');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate email
 * Rules: Valid email format
 */
export const validateEmail = (email) => {
  const errors = [];
  
  if (!email) {
    errors.push('Email is required');
    return { isValid: false, errors };
  }
  
  if (typeof email !== 'string') {
    errors.push('Email must be a string');
    return { isValid: false, errors };
  }
  
  const trimmedEmail = email.trim().toLowerCase();
  
  if (trimmedEmail.length > 254) {
    errors.push('Email must not exceed 254 characters');
  }
  
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  if (!emailRegex.test(trimmedEmail)) {
    errors.push('Email format is invalid');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate account type
 * Rules: Must be one of the predefined types
 * Default: community member
 */
export const validateAccountType = (accountType) => {
  const errors = [];
  const validTypes = ['admin', 'contributor', 'community member'];
  
  // If no account type provided, set default to 'community member'
  if (!accountType) {
    return { isValid: true, errors: [], value: 'community member' };
  }
  
  if (typeof accountType !== 'string') {
    errors.push('Account type must be a string');
    return { isValid: false, errors };
  }
  
  const lowerType = accountType.toLowerCase();
  
  if (!validTypes.includes(lowerType)) {
    errors.push(`Account type must be one of: ${validTypes.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    value: lowerType
  };
};

/**
 * Validate age
 * Rules: Must be a number between 13 and 120
 */
export const validateAge = (age) => {
  const errors = [];
  
  if (age === null || age === undefined) {
    errors.push('Age is required');
    return { isValid: false, errors };
  }
  
  const ageNum = Number(age);
  
  if (isNaN(ageNum)) {
    errors.push('Age must be a valid number');
    return { isValid: false, errors };
  }
  
  if (!Number.isInteger(ageNum)) {
    errors.push('Age must be a whole number');
  }
  
  if (ageNum < 13) {
    errors.push('Age must be at least 13');
  }
  
  if (ageNum > 120) {
    errors.push('Age must not exceed 120');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate gender
 * Rules: Must be one of the predefined options
 */
export const validateGender = (gender) => {
  const errors = [];
  const validGenders = ['male', 'female', 'non-binary', 'other', 'prefer-not-to-say'];
  
  if (!gender) {
    errors.push('Gender is required');
    return { isValid: false, errors };
  }
  
  if (typeof gender !== 'string') {
    errors.push('Gender must be a string');
    return { isValid: false, errors };
  }
  
  const lowerGender = gender.toLowerCase();
  
  if (!validGenders.includes(lowerGender)) {
    errors.push(`Gender must be one of: ${validGenders.join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Validate complete user data
 * Validates all user fields and returns consolidated results
 */
export const validateUserData = (userData) => {
  const {
    username,
    password,
    firstName,
    lastName,
    email,
    accountType,
    age,
    gender
  } = userData;
  
  const validationResults = {
    username: validateUsername(username),
    password: validatePassword(password),
    firstName: validateFirstName(firstName),
    lastName: validateLastName(lastName),
    email: validateEmail(email),
    accountType: validateAccountType(accountType),
    age: validateAge(age),
    gender: validateGender(gender)
  };
  
  const allErrors = {};
  let isValid = true;
  const sanitizedData = {};
  
  Object.keys(validationResults).forEach(field => {
    if (!validationResults[field].isValid) {
      isValid = false;
      allErrors[field] = validationResults[field].errors;
    }
    // Store the validated/default value if provided
    if (validationResults[field].value !== undefined) {
      sanitizedData[field] = validationResults[field].value;
    }
  });
  
  return {
    isValid,
    errors: allErrors,
    validationResults,
    sanitizedData
  };
};

/**
 * validateScrapeUrl
 * -----------------
 * Validates a URL provided for web scraping.
 * Rejects invalid URLs and private/internal addresses (SSRF protection).
 *
 * Returns { isValid, value, errors }
 */
export const validateScrapeUrl = (url) => {
  const errors = [];

  if (!url || typeof url !== 'string' || url.trim() === '') {
    return { isValid: false, value: null, errors: ['url is required.'] };
  }

  const trimmed = url.trim();

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { isValid: false, value: null, errors: ['url must be a valid URL.'] };
  }

  // Only allow http and https
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    errors.push('url must use http or https.');
  }

  // SSRF protection — block private / loopback / link-local ranges
  const hostname = parsed.hostname.toLowerCase();

  const blocked = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^::1$/,
    /^0\.0\.0\.0$/,
    /^169\.254\./,         // link-local
    /^fc00:/i,             // IPv6 ULA
    /^fe80:/i,             // IPv6 link-local
    /\.internal$/i,
    /\.local$/i,
  ];

  if (blocked.some((pattern) => pattern.test(hostname))) {
    errors.push('url must not point to a private or internal address.');
  }

  if (errors.length) {
    return { isValid: false, value: null, errors };
  }

  return { isValid: true, value: trimmed, errors: [] };
};
