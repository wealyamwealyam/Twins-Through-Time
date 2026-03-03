/**
 * User routes with validation
 */

import express from 'express';
import { validateUserInput } from '../middleware/validateUser.js';

const router = express.Router();

/**
 * POST /api/users/register
 * Register a new user with validation
 */
router.post('/register', validateUserInput, (req, res) => {
  // At this point, req.validatedUser contains sanitized and validated data
  const user = req.validatedUser;
  
  // TODO: Add actual user registration logic here
  // - Check if username/email already exists
  // - Hash password
  // - Save to database
  
  // For now, return success with the validated data (without password)
  const { password, ...userWithoutPassword } = user;
  
  res.status(201).json({
    success: true,
    message: 'User validation successful',
    user: userWithoutPassword,
    note: 'This is a mock response. Implement actual user creation logic.'
  });
});

/**
 * POST /api/users/validate
 * Validate user data without creating a user (for testing)
 */
router.post('/validate', validateUserInput, (req, res) => {
  const { password, ...userWithoutPassword } = req.validatedUser;
  
  res.status(200).json({
    success: true,
    message: 'All validation checks passed',
    validatedData: userWithoutPassword
  });
});

/**
 * GET /api/users/validation-rules
 * Get validation rules documentation
 */
router.get('/validation-rules', (req, res) => {
  res.json({
    success: true,
    rules: {
      username: {
        required: true,
        minLength: 3,
        maxLength: 30,
        pattern: 'Alphanumeric with underscores and hyphens only',
        example: 'john_doe123'
      },
      password: {
        required: true,
        minLength: 8,
        maxLength: 128,
        requirements: [
          'At least one uppercase letter',
          'At least one lowercase letter',
          'At least one number',
          'At least one special character'
        ],
        example: 'SecurePass123!'
      },
      firstName: {
        required: true,
        minLength: 1,
        maxLength: 50,
        pattern: 'Letters, spaces, hyphens, and apostrophes only',
        example: "Mary-Jane O'Connor"
      },
      lastName: {
        required: true,
        minLength: 1,
        maxLength: 50,
        pattern: 'Letters, spaces, hyphens, and apostrophes only',
        example: 'Smith-Johnson'
      },
      email: {
        required: true,
        maxLength: 254,
        pattern: 'Valid email format',
        example: 'user@example.com'
      },
      accountType: {
        required: false,
        allowedValues: ['admin', 'contributor', 'community member'],
        default: 'community member',
        example: 'community member',
        note: 'If not provided, defaults to "community member"'
      },
      age: {
        required: true,
        type: 'integer',
        minimum: 13,
        maximum: 120,
        example: 25
      },
      gender: {
        required: true,
        allowedValues: ['male', 'female', 'non-binary', 'other', 'prefer-not-to-say'],
        example: 'prefer-not-to-say'
      }
    }
  });
});

export default router;
