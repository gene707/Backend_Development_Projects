import { Router } from 'express';
import { validateContactSubmission } from '../middleware/validateContact.js';
import * as storageService from '../services/storageService.js';
import * as emailService from '../services/emailService.js';

const router = Router();

// POST /api/contact - Receive form data, validate, persist, and forward via email
router.post('/', validateContactSubmission, async (req, res) => {
  try {
    const { name, email, subject, message, phone } = req.body;

    // 1. Persist submission to persistent store
    const initialRecord = await storageService.saveSubmission({
      name,
      email,
      subject,
      message,
      phone,
      deliveryStatus: 'processing'
    });

    // 2. Dispatch email notification
    const emailResult = await emailService.sendContactEmail(initialRecord);

    // 3. Update persistent record with delivery proof
    const updatedRecord = await storageService.updateSubmissionStatus(
      initialRecord.id,
      emailResult.success ? 'delivered' : 'stored_offline',
      {
        messageId: emailResult.messageId || null,
        previewUrl: emailResult.previewUrl || null,
        recipient: emailResult.recipient || null,
        deliveredAt: new Date().toISOString()
      }
    );

    res.status(201).json({
      success: true,
      message: 'Thank you! Your contact message has been received and processed successfully.',
      submissionId: updatedRecord.id,
      proof: {
        persisted: true,
        deliveryStatus: updatedRecord.deliveryStatus,
        emailProof: updatedRecord.emailProof,
        submittedAt: updatedRecord.submittedAt
      }
    });
  } catch (error) {
    console.error('Contact processing failed:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your message. Please try again later.'
    });
  }
});

// GET /api/contact/submissions - Evidence / Proof of stored submissions
router.get('/submissions', async (_req, res) => {
  try {
    const submissions = await storageService.getAllSubmissions();
    res.status(200).json({
      success: true,
      count: submissions.length,
      submissions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve stored submissions'
    });
  }
});

// GET /api/contact/submissions/:id - View single submission evidence
router.get('/submissions/:id', async (req, res) => {
  try {
    const submission = await storageService.getSubmissionById(req.params.id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found'
      });
    }
    res.status(200).json({
      success: true,
      submission
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve submission'
    });
  }
});

export default router;
