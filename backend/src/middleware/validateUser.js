/**
 * Middleware for validating user input
 */

import { validateUserData } from '../utils/validators.js';

/**
 * Middleware to validate user registration/update data
 */
export const validateUserInput = (req, res, next) => {
  const userData = req.body;
  
  // Validate all user data
  const validation = validateUserData(userData);
  
  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: validation.errors
    });
  }
  
  // If validation passes, sanitize and attach cleaned data to request
  req.validatedUser = {
    username: userData.username.trim(),
    password: userData.password, // Don't trim password (spaces might be intentional)
    firstName: userData.firstName.trim(),
    lastName: userData.lastName.trim(),
    email: userData.email.trim().toLowerCase(),
    accountType: validation.sanitizedData.accountType || userData.accountType?.toLowerCase() || 'community member',
    age: Number(userData.age),
    gender: userData.gender.toLowerCase()
  };
  
  next();
};

/**
 * Middleware to validate partial user updates (all fields optional)
 */
export const validateUserUpdate = (req, res, next) => {
  const updateData = req.body;
  const errors = {};
  let hasError = false;
  
  // Import validators
  const validators = {
    username: (val) => import('../utils/validators.js').then(m => m.validateUsername(val)),
    password: (val) => import('../utils/validators.js').then(m => m.validatePassword(val)),
    firstName: (val) => import('../utils/validators.js').then(m => m.validateFirstName(val)),
    lastName: (val) => import('../utils/validators.js').then(m => m.validateLastName(val)),
    email: (val) => import('../utils/validators.js').then(m => m.validateEmail(val)),
    accountType: (val) => import('../utils/validators.js').then(m => m.validateAccountType(val)),
    age: (val) => import('../utils/validators.js').then(m => m.validateAge(val)),
    gender: (val) => import('../utils/validators.js').then(m => m.validateGender(val))
  };
  
  // Only validate fields that are present
  const validationPromises = Object.keys(updateData)
    .filter(field => validators[field])
    .map(async field => {
      const validator = validators[field];
      const result = await validator(updateData[field]);
      
      if (!result.isValid) {
        errors[field] = result.errors;
        hasError = true;
      }
    });
  
  Promise.all(validationPromises).then(() => {
    if (hasError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    
    next();
  }).catch(err => {
    return res.status(500).json({
      success: false,
      message: 'Validation error',
      error: err.message
    });
  });
};
