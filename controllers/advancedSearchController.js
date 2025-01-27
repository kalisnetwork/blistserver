import { getLatLongFromArea, getLatLongFromPostalCode, calculateDistance, fetchBusinesses } from '../utils/apiUtils.js';
import { fetchGoogleBusinessesWithRadius, createBusinessObject, mapSubscriptionData } from '../utils/commonUtils.js';
import { SORT_OPTIONS } from '../utils/searchUtils.js';
import { db } from '../utils/firebase.js';
import { collection, getDocs } from 'firebase/firestore';
import { categoryToGooglePlacesMapping } from '../utils/categoryMapping.js';
import { googleMapsApiKey } from '../config.js';

const advancedSearch = async (req, res) => {
  try {
    const { 
      latitude, 
      longitude, 
      minRating = 0, 
      businessStatus, 
      sortBy = SORT_OPTIONS.DISTANCE, 
      ascending = 'true', 
      limit = 20, 
      offset = 0, 
      includeDetails = 'false', 
      query,
      category,
      openNow,
      area,
      postalCode,
      ...otherParams 
    } = req.query;

    let coordinates = null;
    // Check for coordinates from different sources
    if (!latitude || !longitude) {
      if (area) {
        coordinates = await getLatLongFromArea(area);
      } else if (postalCode) {
        coordinates = await getLatLongFromPostalCode(postalCode);
      }
    } else {
      coordinates = { latitude, longitude };
    }

    if (!coordinates && !query) {
      return res.status(400).json({ error: "Location (coordinates, area, or postal code) or query is required" });
    }

    let searchQuery = '';
    const radii = [500, 1000, 1500, 2000, 2500, 3000];
    let allGoogleBusinesses = [];
    const startIndex = parseInt(offset);
    const endIndex = parseInt(limit) + startIndex;
    let currentRadiusIndex = 0;
    if (offset > 0) {
      currentRadiusIndex = Math.floor(startIndex / parseInt(limit));
    }

    // Build the search query
    let baseUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json?';
    
    if (query && category) {
      // Combine both query and category
      searchQuery = `${query} ${category}`;
    } else if (query) {
      searchQuery = query;
    } else if (category) {
      searchQuery = category;
    } else {
      searchQuery = 'pharmacy|hospital|doctor|convenience_store|grocery_or_supermarket|bakery|restaurant|cafe|hardware_store|electrician|gym|car_repair|bicycle_store|mechanic';
    }

    baseUrl += `query=${encodeURIComponent(searchQuery)}`;

    // Add location bias if coordinates are available
    if (coordinates) {
      baseUrl += `&location=${coordinates.latitude},${coordinates.longitude}`;
      baseUrl += `&locationbias=circle:${5000}@${coordinates.latitude},${coordinates.longitude}`;
    }

    // Add type if category is mapped
    if (category && categoryToGooglePlacesMapping[category]) {
      baseUrl += `&type=${categoryToGooglePlacesMapping[category].type}`;
    }

    baseUrl += `&key=${googleMapsApiKey}`;

    // Rest of your existing code remains the same...
    
    let apiCallCount = 0;

    if (coordinates) {
      for (let i = 0; i <= currentRadiusIndex; i++) {
        const radius = radii[i];
        console.log(`Making API call with radius: ${radius}`);
        allGoogleBusinesses = await fetchGoogleBusinessesWithRadius(baseUrl, coordinates, radius, limit, offset, allGoogleBusinesses);
        await new Promise(resolve => setTimeout(resolve, 200));
        apiCallCount++;
        console.log(`API call #${apiCallCount}: ${baseUrl}&radius=${radius}`);
      }
    } else {
      let googleResponse = await fetchBusinesses(baseUrl);
      allGoogleBusinesses = googleResponse.results;
      apiCallCount++;
      console.log(`API call #${apiCallCount}: ${baseUrl}`);
    }

    console.log(`Total API calls made: ${apiCallCount}`);
    console.log(`Total businesses found: ${allGoogleBusinesses.length}`);

    allGoogleBusinesses = allGoogleBusinesses?.map(business => createBusinessObject(business, 'Google Maps', coordinates));

    const querySnapshot = await getDocs(collection(db, 'businessListings'));
    const firebaseBusinesses = [];
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      const subscriptions = (data.subscriptions || []).map(mapSubscriptionData);
      const pamphlets = data.pamphlets || [];
      const offers = data.offers || [];
      firebaseBusinesses.push({
        ...createBusinessObject({ ...data, id: doc.id }, 'Firebase', coordinates),
        id: doc.id,
        placeId: data.placeId || null,
        subscriptions,
        pamphlets,
        offers
      });
    }

    let filteredFirebaseBusinesses = firebaseBusinesses.filter(business => searchQuery ? (
      business.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      business.mainCategory?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      business.subCategory?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      business.availableServices?.toLowerCase().includes(searchQuery.toLowerCase())
    ) : true);

    if (coordinates) {
      filteredFirebaseBusinesses = await Promise.all(filteredFirebaseBusinesses.map(async business => {
        let lat = business.latitude;
        let lng = business.longitude;
        if ((lat == null || lng == null) && (business.streetAddress || business.city || business.postalCode)) {
          const addressString = `${business.streetAddress ? business.streetAddress + ', ' : ''}${business.city ? business.city + ', ' : ''}${business.postalCode ? business.postalCode : ''}`;
          const geoCode = await getLatLongFromArea(addressString);
          if (geoCode && geoCode.latitude && geoCode.longitude) {
            lat = geoCode.latitude;
            lng = geoCode.longitude;
          }
        }
        return createBusinessObject({
          ...business,
          distance: calculateDistance(
            parseFloat(coordinates.latitude),
            parseFloat(coordinates.longitude),
            lat,
            lng
          ),
          latitude: lat,
          longitude: lng
        }, 'Firebase', coordinates);
      }));

      filteredFirebaseBusinesses = filteredFirebaseBusinesses.filter(business => business.distance !== null);
    }

    let businesses = [...filteredFirebaseBusinesses, ...allGoogleBusinesses];
    const uniqueBusinesses = [];
    const seenPlaceIds = new Set();
    for (const business of businesses) {
      if (business.placeId) {
        if (!seenPlaceIds.has(business.placeId)) {
          uniqueBusinesses.push(business);
          seenPlaceIds.add(business.placeId);
        }
      } else {
        uniqueBusinesses.push(business);
      }
    }
    businesses = uniqueBusinesses;

    console.log(`Total Firebase businesses combined: ${firebaseBusinesses.length}`);
    console.log(`Total combined businesses: ${businesses.length}`);

    if (businesses.length === 0) {
      return res.json({ results: [], total: 0, message: "No businesses found matching the search criteria." });
    }

    if (minRating > 0) {
      businesses = businesses.filter(business => (business.rating || 0) >= minRating);
    }
    if (openNow === 'true') {
      businesses = businesses.filter(business => business.openNow === true);
    } else if (openNow === 'false') {
      businesses = businesses.filter(business => business.openNow === false);
    }
    if (businessStatus) {
      businesses = businesses.filter(business => business.businessStatus === businessStatus);
    }

    switch (sortBy) {
      case SORT_OPTIONS.DISTANCE:
        businesses.sort((a, b) => {
          if (a.distance === null && b.distance === null) return 0;
          if (a.distance === null) return 1;
          if (b.distance === null) return -1;
          return ascending === 'true' ? (a.distance - b.distance) : (b.distance - a.distance);
        });
        break;
      case SORT_OPTIONS.RATING:
        businesses.sort((a, b) => ascending === 'true' ?
          ((a.rating || 0) - (b.rating || 0)) :
           ((b.rating || 0) - (a.rating || 0)));
        break;
      case SORT_OPTIONS.PRICE:
        businesses.sort((a, b) => ascending === 'true' ?
          ((a.priceLevel || 0) - (b.priceLevel || 0)) :
           ((b.priceLevel || 0) - (a.priceLevel || 0)));
        break;
      case SORT_OPTIONS.NAME:
        businesses.sort((a, b) => ascending === 'true' ?
          (a.businessName || '').localeCompare(b.businessName || '') :
          (b.businessName || '').localeCompare(a.businessName || ''));
        break;
    }

    const paginatedBusinesses = businesses.slice(startIndex, endIndex);

    console.log(`Returning businesses ${startIndex} to ${endIndex}`);
    const response = {
      results: paginatedBusinesses,
      total: businesses.length,
      offset: parseInt(offset),
      limit: parseInt(limit),
      hasMore: businesses.length > endIndex,
    };

    res.json(response);
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({ error: 'Failed to fetch search results' });
  }
};

export default advancedSearch;

