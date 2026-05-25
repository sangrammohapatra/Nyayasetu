'use strict';

const express = require('express');
const { body, validationResult } = require('express-validator');

const paymentController = require('../controllers/payment.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const validate = (checks) => [
  ...checks,
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      const fields = {};
      errors.array().forEach((error) => {
        fields[error.path] = error.msg;
      });

      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Validation failed',
        fields,
      });
    }

    next();
  }),
];

router.use(verifyToken);

router.post(
  '/create',
  validate([
    body('plan')
      .notEmpty().withMessage('plan is required')
      .isString().withMessage('plan must be a string')
      .trim(),
    body('billingCycle')
      .notEmpty().withMessage('billingCycle is required')
      .isIn(['monthly', 'annual']).withMessage('billingCycle must be monthly or annual'),
    body('persona')
      .optional()
      .isIn(['citizen', 'lawyer', 'paralegal'])
      .withMessage('persona must be citizen, lawyer, or paralegal'),
  ]),
  paymentController.createSubscriptionOrder
);

router.post(
  '/verify',
  validate([
    body('orderId')
      .notEmpty().withMessage('orderId is required')
      .isString().withMessage('orderId must be a string')
      .trim(),
    body('paymentId')
      .notEmpty().withMessage('paymentId is required')
      .isString().withMessage('paymentId must be a string')
      .trim(),
    body('signature')
      .notEmpty().withMessage('signature is required')
      .isString().withMessage('signature must be a string')
      .trim(),
    body('plan')
      .notEmpty().withMessage('plan is required')
      .isString().withMessage('plan must be a string')
      .trim(),
    body('billingCycle')
      .notEmpty().withMessage('billingCycle is required')
      .isIn(['monthly', 'annual']).withMessage('billingCycle must be monthly or annual'),
    body('persona')
      .optional()
      .isIn(['citizen', 'lawyer', 'paralegal'])
      .withMessage('persona must be citizen, lawyer, or paralegal'),
  ]),
  paymentController.verifySubscription
);

router.get('/current', paymentController.getCurrentSubscription);

router.post('/cancel', paymentController.cancelUserSubscription);

module.exports = router;
