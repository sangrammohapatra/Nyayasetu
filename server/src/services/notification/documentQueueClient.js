'use strict';

const Bull = require('bull');

const logger = require('../../utils/logger');
const { QUEUE_NAMES } = require('../../config/constants');
const Document = require('../../models/Document.model');
const ChatSession = require('../../models/ChatSession.model');
const DocumentTemplate = require('../../models/DocumentTemplate.model');
const User = require('../../models/User.model');

let documentQueueInstance = null;

const PRIORITY_MAP = {
  high: 1,
  normal: 5,
  low: 10,
};

function getDocumentQueue() {
  if (documentQueueInstance) {
    return documentQueueInstance;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  documentQueueInstance = new Bull(QUEUE_NAMES.DOCUMENTS, redisUrl, {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 50,
      removeOnFail: 20,
    },
  });

  documentQueueInstance.on('error', (error) => {
    logger.error('[documentQueueClient] Queue error', { error: error.message });
  });

  logger.info('[documentQueueClient] Document queue initialised');
  return documentQueueInstance;
}

function normalizePriority(priority) {
  if (!priority) {
    return PRIORITY_MAP.normal;
  }

  if (typeof priority === 'number') {
    return priority;
  }

  return PRIORITY_MAP[String(priority).toLowerCase()] || PRIORITY_MAP.normal;
}

function isSubscriptionActive(user) {
  return Boolean(
    user?.subscription?.plan &&
    user.subscription.plan !== 'free' &&
    user.subscription.validUntil &&
    new Date() < new Date(user.subscription.validUntil)
  );
}

function resolveAccessType(user, template) {
  if (template?.isAlwaysFree) {
    return 'free_tier';
  }

  if (isSubscriptionActive(user)) {
    return 'subscription';
  }

  return 'free_tier';
}

async function resolveDocumentContext({ documentId, sessionId, userId, templateId }) {
  if (documentId) {
    const document = await Document.findById(documentId).select('_id session user template templateSlug title');

    if (!document) {
      throw new Error(`Document not found for documentId ${documentId}`);
    }

    return {
      document,
      sessionId: document.session?.toString(),
      userId: userId || document.user?.toString(),
    };
  }

  if (!sessionId) {
    throw new Error('enqueueGenerateDocument requires either documentId or sessionId');
  }

  const session = await ChatSession.findById(sessionId)
    .populate('template')
    .select('user template templateSlug userState userLanguage generatedDocument status');

  if (!session) {
    throw new Error(`Chat session not found for sessionId ${sessionId}`);
  }

  const effectiveUserId = userId || session.user?.toString();
  if (!effectiveUserId) {
    throw new Error(`Unable to resolve user for sessionId ${sessionId}`);
  }

  if (session.generatedDocument) {
    const existingDocument = await Document.findById(session.generatedDocument)
      .select('_id session user template templateSlug title');

    if (existingDocument) {
      return {
        document: existingDocument,
        sessionId: session._id.toString(),
        userId: effectiveUserId,
      };
    }
  }

  const existingSessionDocument = await Document.findOne({ session: session._id, isDeleted: false })
    .sort({ createdAt: -1 })
    .select('_id session user template templateSlug title');

  if (existingSessionDocument) {
    if (!session.generatedDocument) {
      session.generatedDocument = existingSessionDocument._id;
      await session.save();
    }

    return {
      document: existingSessionDocument,
      sessionId: session._id.toString(),
      userId: effectiveUserId,
    };
  }

  const template = session.template || (
    templateId ? await DocumentTemplate.findById(templateId) : await DocumentTemplate.findOne({ slug: session.templateSlug })
  );

  if (!template) {
    throw new Error(`Document template not found for sessionId ${sessionId}`);
  }

  const user = await User.findById(effectiveUserId).select('subscription state district');
  if (!user) {
    throw new Error(`User not found for userId ${effectiveUserId}`);
  }

  const accessType = resolveAccessType(user, template);
  const isPaid = template.isAlwaysFree || accessType !== 'free_tier';

  const document = await Document.create({
    user: effectiveUserId,
    session: session._id,
    template: template._id,
    templateSlug: template.slug,
    title: `${template.name}${session.userState ? ` - ${session.userState}` : ''}`,
    content: 'Generating document...',
    contentHtml: '<p>Generating document...</p>',
    language: session.userLanguage || 'en',
    accessType,
    isPaid,
    jurisdiction: {
      state: session.userState || user.state || null,
      district: user.district || null,
    },
    version: 1,
  });

  session.generatedDocument = document._id;
  if (session.status === 'data_complete') {
    session.status = 'generating';
  }
  await session.save();

  logger.info('[documentQueueClient] Created document stub for queueing', {
    documentId: document._id.toString(),
    sessionId: session._id.toString(),
    userId: effectiveUserId,
    templateSlug: template.slug,
  });

  return {
    document,
    sessionId: session._id.toString(),
    userId: effectiveUserId,
  };
}

async function enqueueGenerateDocument({
  documentId,
  sessionId,
  userId,
  templateId,
  source = 'web',
  priority = 'normal',
} = {}) {
  const context = await resolveDocumentContext({
    documentId,
    sessionId,
    userId,
    templateId,
  });

  if (!context.sessionId) {
    throw new Error(`Unable to resolve sessionId for document ${context.document._id}`);
  }

  const queue = getDocumentQueue();
  const resolvedPriority = normalizePriority(priority);
  const resolvedDocumentId = context.document._id.toString();
  const resolvedUserId = context.userId.toString();
  const resolvedSessionId = context.sessionId.toString();

  const job = await queue.add(
    'generateDocument',
    {
      documentId: resolvedDocumentId,
      sessionId: resolvedSessionId,
      userId: resolvedUserId,
      source,
    },
    {
      jobId: `doc_${resolvedDocumentId}`,
      priority: resolvedPriority,
    }
  );

  logger.info('[documentQueueClient] Document job enqueued', {
    jobId: job.id,
    documentId: resolvedDocumentId,
    sessionId: resolvedSessionId,
    userId: resolvedUserId,
    priority: resolvedPriority,
    source,
  });

  return {
    jobId: job.id,
    documentId: resolvedDocumentId,
    sessionId: resolvedSessionId,
    userId: resolvedUserId,
  };
}

async function closeDocumentQueue() {
  if (!documentQueueInstance) {
    return;
  }

  await documentQueueInstance.close();
  documentQueueInstance = null;
}

module.exports = {
  enqueueGenerateDocument,
  getDocumentQueue,
  closeDocumentQueue,
};
