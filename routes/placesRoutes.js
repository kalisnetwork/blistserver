import express from 'express';
import advancedSearch from '../controllers/advancedSearchController.js';
import searchNearby from '../controllers/nearbySearchController.js';
import { getBusinessListings, getLatLongByPostalCode } from '../controllers/businessListingsController.js';

const router = express.Router();

router.get('/search', advancedSearch);
router.get('/search/nearby', searchNearby);
router.get('/listings', getBusinessListings);
router.get('/geocode/postalcode', getLatLongByPostalCode);

export default router;
