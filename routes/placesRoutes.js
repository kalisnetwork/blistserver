// src/routes/placesRoutes.js
import express from 'express';
import placesController from '../controllers/placesController.js';

const router = express.Router();

router.get('/search', placesController.textSearch);
router.get('/nearby', placesController.nearbySearch);

export default router;