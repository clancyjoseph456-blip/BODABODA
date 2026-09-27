const db = require('../config/db');
const { assertCanAccess, logAction } = require('./riderController');

/**
 * Fuel is deliberately NOT an expense category here — it is booked
 * automatically whenever a trip is created. Recording it manually would let
 * revenue and costs drift apart.
 */
const MANUAL_CATEGORIES = ['maintenance', 'insurance', 'permit', 'equipment', 'other'];

/** POST /api/riders/:riderId/expenses */
async function createExpense(req, res) {
  await assertCanAccess(req, req.params.riderId);
  const { label, amount, category } = req.body;

  const result = await db.execute(
    'INSERT INTO expenses (rider_id, label, amount, category) VALUES (?, ?, ?, ?)',
    [req.params.riderId, label, amount, MANUAL_CATEGORIES.includes(category) ? category : 'other']
  );

  await logAction(req.user.id, 'expense.created', 'expense', result.insertId, {
    rider_id: req.params.riderId, amount
  });

  return res.status(201).json({ message: 'Expense recorded.', expense_id: result.insertId });
}

/** GET /api/riders/:riderId/expenses */
async function listExpenses(req, res) {
  await assertCanAccess(req, req.params.riderId);

  const expenses = await db.query(
    'SELECT * FROM expenses WHERE rider_id = ? ORDER BY created_at DESC, id DESC',
    [req.params.riderId]
  );

  return res.json(expenses);
}

/** DELETE /api/riders/:riderId/expenses/:id */
async function deleteExpense(req, res) {
  await assertCanAccess(req, req.params.riderId);
  const result = await db.execute('DELETE FROM expenses WHERE id = ? AND rider_id = ?', [
    req.params.id,
    req.params.riderId
  ]);

  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'Expense not found.' });
  }

  await logAction(req.user.id, 'expense.deleted', 'expense', req.params.id, null);
  return res.json({ message: 'Expense deleted.' });
}

module.exports = { createExpense, listExpenses, deleteExpense };
