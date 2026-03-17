import { Router } from 'express';
import {
  createUserHandler,
  getUserHandler,
  updateUserHandler,
  deleteUserHandler,
  listUsersHandler,
} from '../controllers/users.controller.js';

const router = Router();

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: List users (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.get('/', listUsersHandler);

/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Create a new user (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               displayName:
 *                 type: string
 *               photoURL:
 *                 type: string
 *               disabled:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: User created
 *       400:
 *         description: Validation error or disallowed email domain
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 */
router.post('/', createUserHandler);

/**
 * @swagger
 * /api/v1/users/{uid}:
 *   get:
 *     summary: Get user by UID
 *     description: Admins may retrieve any user. Non-admins may only retrieve their own profile.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User record
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — non-admin users may only retrieve their own profile
 *       404:
 *         description: User not found
 */
router.get('/:uid', getUserHandler);

/**
 * @swagger
 * /api/v1/users/{uid}:
 *   patch:
 *     summary: Update user by UID
 *     description: >
 *       Admins may update any user with all fields.
 *       Non-admins may only update their own profile and are restricted to
 *       non-sensitive fields (displayName, photoURL).
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
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
 *                 description: Admin only
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: Admin only
 *               displayName:
 *                 type: string
 *               photoURL:
 *                 type: string
 *               disabled:
 *                 type: boolean
 *                 description: Admin only
 *     responses:
 *       200:
 *         description: Updated user record
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — non-admin users may only update their own profile
 *       404:
 *         description: User not found
 */
router.patch('/:uid', updateUserHandler);

/**
 * @swagger
 * /api/v1/users/{uid}:
 *   delete:
 *     summary: Delete user by UID (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: uid
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: User deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: User not found
 */
router.delete('/:uid', deleteUserHandler);

export default router;
