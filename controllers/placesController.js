import { googleMapsApiKey } from '../config.js';
import {
  fetchBusinesses,
  _fetchPlaceDetailsAndCombine,
  getLatLongFromPostalCode,
  getLatLongFromArea,
  applyFilters,
  applySorting,
   calculateDistance
} from '../utils/apiUtils.js';
import { categoryToGooglePlacesMapping } from '../utils/categoryMapping.js';
import { SEARCH_TYPES, SORT_OPTIONS } from '../utils/searchUtils.js';
import { db } from '../utils/firebase.js';
import { collection, getDocs } from 'firebase/firestore';

// Helper function to map Subscription data
const mapSubscriptionData = (sub) => ({
  price: sub.price || 0,
  billingCycle: sub.billingCycle || 'monthly',
  paymentStatus: sub.paymentStatus || 'incomplete',
  paymentDate: sub.paymentDate ? sub.paymentDate.toDate() : null,
});


  const fetchGoogleBusinessesWithRadius = async (baseUrl, coordinates, radius, limit, offset, existingBusinesses) => {
      let allGoogleBusinesses = existingBusinesses || [];
      let next_page_token;
      let fetchedCount = 0;
      const baseUrlWithRadius = baseUrl + `&location=${coordinates.latitude},${coordinates.longitude}&radius=${radius}` +
          `&locationbias=circle:${radius}@${coordinates.latitude},${coordinates.longitude}`
       do {
          let currentUrl = baseUrlWithRadius + (next_page_token ? `&pagetoken=${next_page_token}` : '');
          let googleBusinesses = await fetchBusinesses(currentUrl);
  
          if (!googleBusinesses || googleBusinesses.length === 0) {
              break;
          }
  
          allGoogleBusinesses = allGoogleBusinesses.concat(googleBusinesses);
          fetchedCount += googleBusinesses.length;
          next_page_token = googleBusinesses[0]?.next_page_token;
           if (next_page_token && fetchedCount >= (parseInt(limit) + parseInt(offset) + 20)) {
                 next_page_token = null; // Stop fetching if we have fetched sufficient amount of google results
              }
              if (next_page_token) {
                   await new Promise(resolve => setTimeout(resolve, 500));
              }
          } while (next_page_token);
          return allGoogleBusinesses;
  }

const advancedSearch = async (req, res) => {
      try {
          const {
              latitude,
              longitude,
              minRating = 0,
              businessStatus,
              sortBy = SORT_OPTIONS.DISTANCE, // Set default sort to DISTANCE
              ascending = 'true', // Set ascending order as true for closest first
              limit = 20,
              offset = 0,
              includeDetails = 'false',
              query,
              category,
              openNow, // Include openNow in parameters
              ...otherParams
          } = req.query;
  
  
          let coordinates = null;
  
          // Condition to require coordinates only when no query or category is available
          if (!query && !category && (!latitude || !longitude)) {
              if (otherParams.area) {
                  coordinates = await getLatLongFromArea(otherParams.area);
              } else if (otherParams.postalCode) {
                  coordinates = await getLatLongFromPostalCode(otherParams.postalCode);
              }
          } else if (latitude && longitude) {
              coordinates = { latitude, longitude };
          }
  
          // Only require coordinates if no query or category is given
          if (!query && !category && !coordinates) {
              return res.status(400).json({ error: "Coordinates, query, or category are required" });
          }
  
          let searchQuery;
         const radii = [500, 1000, 1500, 2000, 2500, 3000];
         let allGoogleBusinesses = [];
          const startIndex = parseInt(offset);
          const endIndex = parseInt(offset) + parseInt(limit);
           let currentRadiusIndex = 0;
          if(offset > 0){
             currentRadiusIndex = Math.floor(startIndex / parseInt(limit));
          }
  
          // Build the base URL with required parameters
          let baseUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json?';
  
          if (query) {
              searchQuery = query;
          } else if (category) {
              searchQuery = category;
          } else {
              searchQuery = 'businesses'; // fallback
          }
          baseUrl += `query=${encodeURIComponent(searchQuery)}`;
  
          // Add location and radius only if coordinates are available
          if (coordinates) {
              baseUrl += `&location=${coordinates.latitude},${coordinates.longitude}`;
  
                   baseUrl += `&locationbias=circle:${2500}@${coordinates.latitude},${coordinates.longitude}` // radius is required when locationbias parameter used.
          }
  
          // Add type if category mapping exists
          if (category && categoryToGooglePlacesMapping[category]) {
              baseUrl += `&type=${categoryToGooglePlacesMapping[category].type}`;
          }
  
          baseUrl += `&key=${googleMapsApiKey}`;
  
          // If coordinates are available, we use radius search, else we don't.
          if (coordinates) {
               for (let i = 0; i <= currentRadiusIndex; i++) {
                    const radius = radii[i];
                      allGoogleBusinesses = await fetchGoogleBusinessesWithRadius(baseUrl, coordinates, radius, limit, offset, allGoogleBusinesses);
                    await new Promise(resolve => setTimeout(resolve, 200));
               }
          } else {
              allGoogleBusinesses = await fetchBusinesses(baseUrl);
          }
  
         allGoogleBusinesses = allGoogleBusinesses.map(business => ({
              businessName: business.businessName,
              formatted_address: business.formatted_address,
              types: business.types,
              placeId: business.placeId,
              phoneNumber: business.phoneNumber,
              websiteUrl: business.websiteUrl,
              businessHours: business.businessHours,
              photos: business.photos,
              rating: business.rating,
              user_ratings_total: business.user_ratings_total,
              geometry: business.geometry,
              availableServices: business.availableServices,
              mainCategory: business.mainCategory,
              subCategory: business.subCategory,
              completeAddress: business.completeAddress,
              city: business.city,
              state: business.state,
              country: business.country,
              source: 'Google Maps',
             distance: coordinates ? calculateDistance(
                  parseFloat(coordinates.latitude),
                  parseFloat(coordinates.longitude),
                  business.geometry?.location?.lat,
                  business.geometry?.location?.lng
              ) : null,
              openNow : business.openNow,
              bannerImageUrl: business.bannerImageUrl,
              subscriptions: [] // default subscription array if not available.
          }));
  
  
          // Fetch results from Firestore
         const querySnapshot = await getDocs(collection(db, 'businessListings'));
         const firebaseBusinesses = [];
          for (const doc of querySnapshot.docs) {
          const data = doc.data();
  
          // Map subscriptions correctly
          const subscriptions = (data.subscriptions || []).map(mapSubscriptionData);
  
          // Retrieve pamphlets and offers (ensuring they're always arrays)
          const pamphlets = data.pamphlets || [];
          const offers = data.offers || [];
  
          // Construct the Firebase business object
          firebaseBusinesses.push({
              id: doc.id,
              ...data,
              source: 'Firebase',
              subscriptions: subscriptions, // Use the mapped subscriptions
              pamphlets: pamphlets,
              offers: offers,
          });
          }
  
          // Filter Firebase results based on the provided query or category
          let filteredFirebaseBusinesses = firebaseBusinesses.filter(business =>
              searchQuery ? (
                  business.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  business.mainCategory?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  business.subCategory?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  business.availableServices?.toLowerCase().includes(searchQuery.toLowerCase())
              ) : true
          );
          // Calculate distance for Firebase businesses
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
      
                  return {
                       businessName: business.businessName,
                      formatted_address: business.formatted_address,
                       types: business.types,
                       placeId: business.placeId,
                      phoneNumber: business.phoneNumber,
                      websiteUrl: business.websiteUrl,
                      businessHours: business.businessHours,
                      photos: business.photos,
                      rating: business.rating,
                      user_ratings_total: business.user_ratings_total,
                     geometry: business.geometry,
                       availableServices: business.availableServices,
                      mainCategory: business.mainCategory,
                       subCategory: business.subCategory,
                      completeAddress: business.completeAddress,
                     city: business.city,
                       state: business.state,
                       country: business.country,
                       source: business.source,
                       businessDescription : business.businessDescription,
                      businessLogoUrl : business.businessLogoUrl,
                      contactPerson : business.contactPerson,
                      designation : business.designation,
                      galleryImageUrls : business.galleryImageUrls,
                      postalCode : business.postalCode,
                      pamphlets: business.pamphlets,
                      offers: business.offers,
                     distance: calculateDistance(
                          parseFloat(coordinates.latitude),
                          parseFloat(coordinates.longitude),
                          lat,
                          lng
                      ),
                     latitude: lat,
                      longitude: lng,
                      openNow: business.openNow,
                      bannerImageUrl: business.bannerImageUrl,
                      subscriptions: business.subscriptions || []
                  };
              }));
                 // Filter by distance
               filteredFirebaseBusinesses = filteredFirebaseBusinesses.filter(business => {
                  return business.distance !== null
              });
           }
  
         // Combine results, prioritize Firebase first
          let businesses = filteredFirebaseBusinesses.length > 0
              ? [...filteredFirebaseBusinesses, ...allGoogleBusinesses]
              : [...allGoogleBusinesses];
  
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
          if (openNow === 'true') {
              businesses = businesses.filter(business => business.openNow === true);
          } else if (openNow === 'false') {
              businesses = businesses.filter(business => business.openNow === false);
          }
  
          if (businessStatus) {
              businesses = businesses.filter(business => business.businessStatus === businessStatus);
          }
  
          // Apply sorting
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
          const hasMore =  businesses.length > endIndex;
  
          // Format response
          const response = {
              results: paginatedBusinesses,
              total: businesses.length,
              offset: parseInt(offset),
              limit: parseInt(limit),
              hasMore: hasMore
          };
  
          res.json(response);
      } catch (error) {
          console.error('Error in advanced search:', error);
          res.status(500).json({ error: 'Failed to fetch search results' });
      }
  };


const searchNearby = async (req, res) => {
  try {
        const {
        latitude,
        longitude,
        category,
        limit = 20,
        offset = 0,
        radius = 2500
      } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Coordinates are required for nearby search' });
    }
      const coordinates = { latitude, longitude };
      let baseUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json?';
    let searchQuery = category || 'businesses'
    baseUrl += `query=${encodeURIComponent(searchQuery)}`;
        baseUrl += `&location=${coordinates.latitude},${coordinates.longitude}`;
        baseUrl += `&radius=${radius}`;
        if (category && categoryToGooglePlacesMapping[category]) {
            baseUrl += `&type=${categoryToGooglePlacesMapping[category].type}`;
        }
        baseUrl += `&key=${googleMapsApiKey}`;
  
    const { results, nextPageToken } = await fetchBusinesses(baseUrl);

     const allGoogleBusinesses = results.map(business => ({
        businessName: business.name,
        formatted_address: business.formatted_address,
        types: business.types,
        placeId: business.place_id,
        phoneNumber: business.phoneNumber,
        websiteUrl: business.websiteUrl,
        businessHours: business.businessHours,
        photos: business.photos,
        rating: business.rating,
        user_ratings_total: business.user_ratings_total,
        geometry: business.geometry,
        availableServices: business.types?.join(", "),
        mainCategory: business.types?.find((type) => (type === 'postal_code')) || business.types?.[0],
        subCategory: business.types?.[1],
        completeAddress: business.completeAddress,
        city: business.city,
        state: business.state,
        country: business.country,
        source: 'Google Maps',
        distance: calculateDistance(
          parseFloat(coordinates.latitude),
          parseFloat(coordinates.longitude),
          business.geometry?.location?.lat,
          business.geometry?.location?.lng
        ),
        openNow: business.openNow,
        bannerImageUrl: business.bannerImageUrl,
        subscriptions: []
      }));
      const startIndex = parseInt(offset);
      const endIndex = startIndex + parseInt(limit);
      const paginatedBusinesses = allGoogleBusinesses.slice(startIndex, endIndex);
  
      const response = {
      results: paginatedBusinesses,
      total: allGoogleBusinesses.length,
      offset: startIndex,
      limit: parseInt(limit),
       hasMore: allGoogleBusinesses.length > endIndex,
       nextPageToken: nextPageToken
      };
      res.json(response);
    } catch (error) {
      console.error('Error in searchNearby:', error);
      res.status(500).json({ error: 'Failed to fetch nearby search results' });
    }
  };

const getLatLongByPostalCode = async (req, res) => {
    const { postalCode } = req.query;
    if (!postalCode) {
      return res.status(400).json({ error: 'Postal code is required' });
    }
    try {
      const coordinates = await getLatLongFromPostalCode(postalCode);
      if (coordinates.latitude && coordinates.longitude) {
        res.json(coordinates);
      } else {
        res.status(404).send({ error: "No data found for this postal code" });
      }
    } catch (error) {
      console.error('Error fetching coordinates by postal code:', error);
      res.status(500).json({ error: 'Failed to fetch coordinates' });
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



  // Fetch business listings from Firestore
  export const getBusinessListings = async (req, res) => {
    try {
      const querySnapshot = await getDocs(collection(db, 'businessListings'));
      const listings = querySnapshot.docs.map(doc => {
        const data = doc.data();

        // Map subscriptions correctly
        const subscriptions = (data.subscriptions || []).map(mapSubscriptionData);

        // Retrieve pamphlets and offers (ensuring they're always arrays)
        const pamphlets = data.pamphlets || [];
        const offers = data.offers || [];

        // Construct the Firebase business object
        return {
          id: doc.id,
          ...data,
          source: 'Firebase',
          subscriptions: subscriptions, // Use the mapped subscriptions
          pamphlets: pamphlets,
          offers: offers,
        };
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
    getBusinessListings,
    getLatLongByPostalCode,
  };