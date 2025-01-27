import { googleMapsApiKey } from '../config.js';
import { fetchBusinesses, calculateDistance } from '../utils/apiUtils.js';
import { categoryToGooglePlacesMapping } from '../utils/categoryMapping.js';
import { SORT_OPTIONS } from '../utils/searchUtils.js';
import { createBusinessObject } from '../utils/commonUtils.js';
import NodeCache from 'node-cache';

// Configure NodeCache with a TTL of 10 minutes and a check period of 1 minute
const cache = new NodeCache({
  stdTTL: 10 * 60, 
  checkperiod: 60, 
});

const searchNearby = async (req, res) => {
  try {
    const { latitude, longitude, category, limit = 20, offset = 0, radius = 3000, sortBy = SORT_OPTIONS.DISTANCE, ascending = 'true' } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Coordinates are required for nearby search' });
    }
    const coordinates = { latitude, longitude };

    const cacheKey = `${latitude}-${longitude}-${radius}-${category}`;
    let allGoogleBusinesses = cache.get(cacheKey);

    if (allGoogleBusinesses) {
      console.log(`Using cached data for ${cacheKey}`);
    } else {
      allGoogleBusinesses = [];
      const baseUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json?';
      const types = category ? [category] : ['pharmacy', 'hospital', 'doctor', 'grocery_or_supermarket', 'restaurant', 'cafe', 'gym'];
      
      let apiCallCount = 0;

      // Function to fetch businesses for a given type
      const fetchBusinessesForType = async (type) => {
        let typeUrl = `${baseUrl}query=${encodeURIComponent(type)}`;
        typeUrl += `&location=${coordinates.latitude},${coordinates.longitude}`;
        typeUrl += `&radius=${radius}`;
        typeUrl += `&key=${googleMapsApiKey}`;

        console.log(`Making API call for type: ${type}`);
        const { results } = await fetchBusinesses(typeUrl);
        apiCallCount++;
        console.log(`API call #${apiCallCount}: ${typeUrl}`);

        return results.map(business => createBusinessObject(business, 'Google Maps', coordinates));
      };

      // Use Promise.all to fetch businesses for all types concurrently
      const businessesByType = await Promise.all(types.map(type => fetchBusinessesForType(type)));

      // Flatten the results from all types
      allGoogleBusinesses = businessesByType.flat();

      console.log(`Total API calls made: ${apiCallCount}`);
      console.log(`Total businesses found: ${allGoogleBusinesses.length}`);

      cache.set(cacheKey, allGoogleBusinesses); // Cache the results
    }

    // Sorting by distance
    if (sortBy === SORT_OPTIONS.DISTANCE) {
      allGoogleBusinesses.sort((a, b) => {
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return ascending === 'true' ? (a.distance - b.distance) : (b.distance - a.distance);
      });
    }

    // Pagination
    const startIndex = parseInt(offset);
    const endIndex = startIndex + parseInt(limit);
    const paginatedBusinesses = allGoogleBusinesses.slice(startIndex, endIndex);

    console.log(`Returning businesses ${startIndex} to ${endIndex}`);
    const response = {
      results: paginatedBusinesses,
      total: allGoogleBusinesses.length,
      offset: startIndex,
      limit: parseInt(limit),
      hasMore: allGoogleBusinesses.length > endIndex,
    };

    res.json(response);
  } catch (error) {
    console.error('Error in searchNearby:', error);
    res.status(500).json({ error: 'Failed to fetch nearby search results' });
  }
};

export default searchNearby;
