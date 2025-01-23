import express from 'express';
import placesController from '../controllers/placesController.js';

const router = express.Router();

router.get('/search', placesController.advancedSearch);
router.get('/search/services', placesController.searchByServices);
router.get('/search/rating', placesController.searchByRating);
router.get('/search/nearby', placesController.searchNearby);
router.get('/businessListings', placesController.getBusinessListings);
export default router;