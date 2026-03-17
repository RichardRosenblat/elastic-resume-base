import { Router } from 'express';
import {
  createUserHandler,
  getUserHandler,
  updateUserHandler,
  deleteUserHandler,
  listUsersHandler,
  getUserRoleHandler,
  getBatchRolesHandler,
} from '../controllers/users.controller.js';

const router = Router();

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: List users
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: maxResults
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *       - in: query
 *         name: pageToken
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/', listUsersHandler);

/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               uid:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               displayName:
 *                 type: string
 *               photoURL:
 *                 type: string
 *               role:
 *                 type: string
 *               disabled:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already in use
 */
router.post('/', createUserHandler);

/**
 * @swagger
 * /api/v1/users/roles/batch:
 *   post:
 *     summary: Get roles for multiple users
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - uids
 *             properties:
 *               uids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Map of uid to role
 *       400:
 *         description: Validation error
 */
router.post('/roles/batch', getBatchRolesHandler);

/**
 * @swagger
 * /api/v1/users/{uid}:
 *   get:
 *     summary: Get user by UID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User record
 *       404:
 *         description: User not found
 */
router.get('/:uid', getUserHandler);

/**
 * @swagger
 * /api/v1/users/{uid}:
 *   patch:
 *     summary: Update user by UID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               displayName:
 *                 type: string
 *               photoURL:
 *                 type: string
 *               role:
 *                 type: string
 *               disabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated user record
 *       404:
 *         description: User not found
 */
router.patch('/:uid', updateUserHandler);

/**
 * @swagger
 * /api/v1/users/{uid}:
 *   delete:
 *     summary: Delete user by UID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: User deleted
 *       404:
 *         description: User not found
 */
router.delete('/:uid', deleteUserHandler);

/**
 * @swagger
 * /api/v1/users/{uid}/role:
 *   get:
 *     summary: Get the access role for a user (BFF access check)
 *     description: >
 *       Implements the BFF Authorization Logic. If ADMIN_SHEET_FILE_ID is configured,
 *       checks Google Drive permissions via Bugle. Otherwise falls back to Firestore.
 *       Returns 403 if the user has no access.
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User role
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 role:
 *                   type: string
 *       403:
 *         description: User does not have access
 *       404:
 *         description: User not found
 */
router.get('/:uid/role', getUserRoleHandler);

export default router;
