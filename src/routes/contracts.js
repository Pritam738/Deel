const express = require('express');
const { Contract } = require('../model'); // Adjust the path as necessary
const { getProfile } = require('../middleware/getProfile');
const Sequelize = require('sequelize');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Contracts
 *   description: Contract management endpoints
 */

/**
 * @swagger
 * /contracts/{id}:
 *   get:
 *     summary: Get a contract by ID
 *     tags: [Contracts]
 *     parameters:
 *       - in: header
 *         name: profile_id
 *         required: true
 *         description: ID of the profile making the request
 *         schema:
 *           type: integer
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the contract
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contract data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contract'
 *       403:
 *         description: Forbidden - User does not own the contract
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Forbidden: You do not own this contract"
 *       404:
 *         description: Contract not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Contract not found"
 */


router.get('/:id', getProfile, async (req, res) => {
  const { id } = req.params;

  try {
    const contract = await Contract.findOne({ where: { id } });

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    const userId = Number(req.get('profile_id'));
    if (contract.ClientId !== userId && contract.ContractorId !== userId) {
      return res.status(403).json({ error: 'Forbidden: You do not own this contract' });
    }

    res.json(contract);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @swagger
 * /contracts:
 *   get:
 *     summary: Get all non-terminated contracts for the current user
 *     tags: [Contracts]
 *     parameters:
 *       - in: header
 *         name: profile_id
 *         required: true
 *         description: ID of the profile making the request
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of active contracts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Contract'
 *       404:
 *         description: No contracts found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: No contracts found
 *       500:
 *         description: Internal Server Error
 */
router.get('/', getProfile, async (req, res) => {
  const userId = req.profile.id;
  try {
    const contracts = await Contract.findAll({
      where: {
        [Sequelize.Op.or]: [
          { ClientId: userId },
          { ContractorId: userId }
        ],
        status: { [Sequelize.Op.ne]: 'terminated' }
      }
    });

    if (!contracts.length) {
      return res.status(404).json({ error: 'No contracts found' });
    }

    res.json(contracts);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
