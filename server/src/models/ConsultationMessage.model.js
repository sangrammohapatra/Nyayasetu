const mongoose = require('mongoose');
const { Schema } = mongoose;

const consultationMessageSchema = new Schema(
  {
    consultation: {
      type: Schema.Types.ObjectId,
      ref: 'Consultation',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['citizen', 'lawyer'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    messageType: {
      type: String,
      enum: ['text', 'document_note'],
      default: 'text',
    },
    documentRef: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

consultationMessageSchema.index({ consultation: 1, createdAt: 1 });

module.exports = mongoose.model('ConsultationMessage', consultationMessageSchema);
