import { googleMapsApiKey } from '../config.js';
import { fetchBusinesses, applyFilters, applySorting, getLatLongFromPostalCode, getLatLongFromArea } from '../utils/apiUtils.js';
import { categoryToGooglePlacesMapping } from '../utils/categoryMapping.js';
import { SEARCH_TYPES, SORT_OPTIONS } from '../utils/searchUtils.js';
import { db } from '../utils/firebase.js';
import { collection, getDocs } from 'firebase/firestore';

// Helper function to calculate distance between two coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Helper function to build an advanced search query
const buildAdvancedSearchQuery = (params) => {
  const {
    businessName,
    area,
    postalCode,
    query,
    category,
    minPrice,
    maxPrice,
    minRating,
    openNow,
    services,
    keywords
  } = params;

  let searchQuery = [];
  let searchParams = new URLSearchParams();

  if (category && categoryToGooglePlacesMapping[category]) {
    searchQuery.push(categoryToGooglePlacesMapping[category].keywords);
    searchParams.append('type', categoryToGooglePlacesMapping[category].type);
  }

  if (businessName) searchQuery.push(businessName);
  if (area) searchQuery.push(area);
  if (postalCode) searchQuery.push(`postal code ${postalCode}`);
  if (query) searchQuery.push(query);
  if (keywords) searchQuery.push(keywords);

  if (openNow) searchParams.append('opennow', 'true');
  if (minPrice) searchParams.append('minprice', minPrice);
  if (maxPrice) searchParams.append('maxprice', maxPrice);
  if (services) searchParams.append('keyword', services);

  return {
    queryString: searchQuery.join(' ').trim(),
    parameters: searchParams.toString()
  };
};

const advancedSearch = async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      radius = 10000,
      minRating = 0,
      businessStatus,
      sortBy = SORT_OPTIONS.RELEVANCE,
      ascending = 'true',
      limit,
      offset = 0,
      includeDetails = 'false',
      query,
      category,
      ...otherParams
    } = req.query;

    let coordinates = null;
    if (!latitude || !longitude) {
      if (otherParams.area) {
        coordinates = await getLatLongFromArea(otherParams.area);
      } else if (otherParams.postalCode) {
        coordinates = await getLatLongFromPostalCode(otherParams.postalCode);
      }
    } else {
      coordinates = { latitude, longitude };
    }
    const searchQuery = query || category;

    const { queryString, parameters } = buildAdvancedSearchQuery({ ...otherParams, query: searchQuery });
      
    let baseUrl;
    if (queryString) {
      baseUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(queryString)}`;
    } else {
      baseUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json?';
    }
    if (coordinates) {
      baseUrl += `&location=${coordinates.latitude},${coordinates.longitude}&radius=${radius}`;
    }

    if (parameters) {
      baseUrl += `&${parameters}`;
    }
    baseUrl += `&key=${googleMapsApiKey}`;
    let allGoogleBusinesses = [];
    let next_page_token;

    do {
        let googleBusinesses = await fetchBusinesses(baseUrl + (next_page_token ? `&pagetoken=${next_page_token}` : ''));
        allGoogleBusinesses = allGoogleBusinesses.concat(googleBusinesses);
        next_page_token = googleBusinesses.length > 0 ? googleBusinesses[0].next_page_token : null
      if(googleBusinesses.length > 0 && !next_page_token){
            next_page_token = null;
        }
    } while (next_page_token);
    
  allGoogleBusinesses = allGoogleBusinesses.map(business => ({
        ...business,
        source: 'Google Maps'
      }));
    
    // Fetch results from Firestore
    const querySnapshot = await getDocs(collection(db, 'businessListings'));
    const firebaseBusinesses = [];
    querySnapshot.forEach((doc) => {
      firebaseBusinesses.push({ id: doc.id, ...doc.data(), source: 'Firebase' });
    });

    // Filter Firebase results based on the provided query or category
  const filteredFirebaseBusinesses = firebaseBusinesses.filter(business => 
      searchQuery ? (business.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      business.mainCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
      business.subCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
      business.availableServices.toLowerCase().includes(searchQuery.toLowerCase())) : true
  );

      // Combine results, prioritize Firebase first
    let businesses;
      if(filteredFirebaseBusinesses.length > 0) {
          businesses = [...filteredFirebaseBusinesses, ...allGoogleBusinesses];
      } else {
           businesses = [...allGoogleBusinesses];
      }
  

    // De-duplicate by placeId
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

    // Handle zero results
    if (businesses.length === 0) {
      return res.json({
        results: [],
        total: 0,
        message: "No businesses found matching the search criteria.",
      });
    }
  
    if (minRating > 0) {
      businesses = businesses.filter(business => (business.rating || 0) >= minRating);
    }

    if (businessStatus) {
      businesses = businesses.filter(business => business.businessStatus === businessStatus);
    }
    
    if (coordinates) {
        businesses = businesses.map(business => ({
          ...business,
          distance: calculateDistance(
            coordinates.latitude,
            coordinates.longitude,
            business.geometry?.location?.lat,
            business.geometry?.location?.lng
          )
        }));
    }

    // Apply sorting
    switch (sortBy) {
      case SORT_OPTIONS.DISTANCE:
          businesses.sort((a, b) => ascending === 'true' ?
              (a.distance - b.distance) : (b.distance - a.distance));
          break;
        case SORT_OPTIONS.RATING:
            businesses.sort((a, b) => ascending === 'true' ?
            ((a.rating || 0) - (b.rating || 0)) : ((b.rating || 0) - (a.rating || 0)));
            break;
      case SORT_OPTIONS.PRICE:
        businesses.sort((a, b) => ascending === 'true' ?
          ((a.priceLevel || 0) - (b.priceLevel || 0)) : ((b.priceLevel || 0) - (a.priceLevel || 0)));
        break;
      case SORT_OPTIONS.NAME:
        businesses.sort((a, b) => ascending === 'true' ?
          a.businessName.localeCompare(b.businessName) : b.businessName.localeCompare(a.businessName));
        break;
      // Add more sorting options as needed
    }

      // Apply pagination
    if (limit) {
      businesses = businesses.slice(offset, offset + parseInt(limit));
    }
      if(businesses.length < 20 && !limit){
          let adjustedLimit = 20
          businesses = businesses.slice(offset, offset + adjustedLimit)
      }

    // Format response
      const response = {
          results: businesses,
          total: businesses.length,
          offset: parseInt(offset),
          limit: limit ? parseInt(limit) : null,
          hasMore: limit ? businesses.length >= parseInt(limit) : businesses.length >= 20
      };
    res.json(response);
  } catch (error) {
    console.error('Error in advanced search:', error);
    res.status(500).json({ error: 'Failed to fetch search results' });
  }
};
// Search by services
const searchByServices = async (req, res) => {
  const { services, ...otherParams } = req.query;
  req.query = { ...otherParams, keywords: services };
  return advancedSearch(req, res);
};

// Search by rating
const searchByRating = async (req, res) => {
  const { minRating, ...otherParams } = req.query;
  req.query = { ...otherParams, minRating, sortBy: SORT_OPTIONS.RATING };
  return advancedSearch(req, res);
};
const searchNearby = async (req, res) => {
  const { latitude, longitude, radius, category, ...otherParams } = req.query;
  if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Coordinates are required for nearby search' });
  }

  let query;
  let type;

  // Map category to Google Places type
  if (category && categoryToGooglePlacesMapping[category]) {
      type = categoryToGooglePlacesMapping[category].type;
  }

  if(type) {
      req.query = { latitude, longitude, radius, ...otherParams, type };
  } else {
    req.query = { latitude, longitude, radius, ...otherParams, query:category };
  }
  
  return advancedSearch(req, res);
};

// Fetch business listings from Firestore
export const getBusinessListings = async (req, res) => {
  try {
    const querySnapshot = await getDocs(collection(db, 'businessListings'));
    const listings = [];
    querySnapshot.forEach((doc) => {
      listings.push({ id: doc.id, ...doc.data() });
    });
    res.json(listings);
  } catch (error) {
    console.error('Error fetching business listings:', error);
    res.status(500).json({ error: 'Failed to fetch business listings' });
  }
};

export default {
  advancedSearch,
  searchByServices,
  searchByRating,
  searchNearby,
  getBusinessListings
};