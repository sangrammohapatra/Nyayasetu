/**
 * NyayaSetu — Model Registry
 * 
 * All 13 Mongoose models exported from a single entry point.
 * Import from here in controllers and services:
 *
 *   const { User, Document, ChatSession } = require('../models');
 *
 * Loading order matters for circular reference safety:
 *   1. Standalone models (no refs to other models)
 *   2. Models with refs to standalone models
 *   3. Models with refs to group-2 models
 */

const User             = require('./User.model');
const LegalAct         = require('./LegalAct.model');        // No external refs
const DocumentTemplate = require('./DocumentTemplate.model'); // No external refs
const AuditLog         = require('./AuditLog.model');         // Refs User

const LawyerProfile    = require('./LawyerProfile.model');    // Refs User, Consultation
const JurisdictionRule = require('./JurisdictionRule.model'); // Refs LegalAct
const Notification     = require('./Notification.model');     // Refs User

const ChatSession      = require('./ChatSession.model');      // Refs User, DocumentTemplate
const Document         = require('./Document.model');         // Refs User, ChatSession, DocumentTemplate, Payment, CaseTracker
const CaseTracker      = require('./CaseTracker.model');      // Refs User, Document

const Subscription     = require('./Subscription.model');     // Refs User
const Payment          = require('./Payment.model');          // Refs User (polymorphic entity)
const Consultation     = require('./Consultation.model');     // Refs User, LawyerProfile, Document, Payment
const RTIApplication   = require('./RTIApplication.model');   // Refs User

module.exports = {
  User,
  LawyerProfile,
  DocumentTemplate,
  ChatSession,
  Document,
  CaseTracker,
  Subscription,
  Payment,
  Consultation,
  JurisdictionRule,
  LegalAct,
  Notification,
  AuditLog,
  RTIApplication,
};
