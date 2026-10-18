import { Router } from 'express';
import crypto from 'node:crypto';
import { run, query, get } from '../../db/connection.js';
import { messageBroker } from '../../broker/messageBroker.js';
import { authenticateJWT, recordAudit } from '../../middleware/auth.js';
import { config } from '../../config/index.js';

const router = Router();

/**
 * POST /api/v1/transactions
 * Ingests a transaction request, writes an initial 'queued' state,
 * and immediately publishes to the message broker for lock-free async processing.
 * Responds with 202 Accepted.
 */
router.post('/', authenticateJWT, async (req, res, next) => {
  try {
    const { amount, recipient, currency = 'USD' } = req.body;

    // Validation
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed: amount must be a positive number',
      });
    }

    if (!recipient || typeof recipient !== 'string' || recipient.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed: recipient is required',
      });
    }

    const transactionId = crypto.randomUUID();
    const cleanRecipient = recipient.trim();
    const cleanCurrency = currency.trim().toUpperCase();

    // 1. Persist initial queued state in database
    await run(
      `INSERT INTO transactions (id, user_id, amount, currency, recipient, status)
       VALUES (?, ?, ?, ?, ?, 'queued');`,
      [transactionId, req.user.id, parsedAmount, cleanCurrency, cleanRecipient]
    );

    // 2. Publish to Asynchronous Message Broker
    const jobPayload = {
      id: transactionId,
      user_id: req.user.id,
      amount: parsedAmount,
      currency: cleanCurrency,
      recipient: cleanRecipient,
      queuedAt: new Date().toISOString(),
    };

    const brokerResult = await messageBroker.publish(config.queueName, jobPayload);

    await recordAudit(
      req.user.id,
      req.user.username,
      req.user.role,
      'TRANSACTION_QUEUED',
      `/api/v1/transactions/${transactionId}`,
      req.ip,
      202
    );

    // 3. Respond immediately with 202 Accepted
    res.status(202).json({
      success: true,
      message: 'Transaction accepted and dispatched to asynchronous message broker queue',
      transactionId,
      status: 'queued',
      broker: brokerResult.broker,
      pollUrl: `/api/v1/transactions/${transactionId}`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/transactions
 * Retrieves transactions.
 * RBAC: 'user' sees only their own; 'manager' and 'admin' see all transactions across ecosystem.
 */
router.get('/', authenticateJWT, async (req, res, next) => {
  try {
    let sql;
    let params = [];

    if (req.user.role === 'user') {
      sql = `
        SELECT t.*, u.username as owner_username
        FROM transactions t
        INNER JOIN users u ON t.user_id = u.id
        WHERE t.user_id = ?
        ORDER BY t.created_at DESC;
      `;
      params = [req.user.id];
    } else {
      sql = `
        SELECT t.*, u.username as owner_username
        FROM transactions t
        INNER JOIN users u ON t.user_id = u.id
        ORDER BY t.created_at DESC;
      `;
    }

    const rows = await query(sql, params);

    res.status(200).json({
      success: true,
      count: rows.length,
      roleTier: req.user.role,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/transactions/:id
 * Retrieves single transaction details.
 */
router.get('/:id', authenticateJWT, async (req, res, next) => {
  try {
    const id = req.params.id;
    const row = await get(
      `SELECT t.*, u.username as owner_username
       FROM transactions t
       INNER JOIN users u ON t.user_id = u.id
       WHERE t.id = ?;`,
      [id]
    );

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found',
      });
    }

    // RBAC check: regular user cannot see someone else's transaction
    if (req.user.role === 'user' && row.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to view another user\'s transaction',
      });
    }

    res.status(200).json({
      success: true,
      data: row,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
